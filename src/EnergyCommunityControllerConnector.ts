import { DataFrame, TModuleContext, TState } from 'bifrost-zero-common'
import { BifrostZeroModule } from 'bifrost-zero-sdk'
import { MQTTConnector } from './MQTTConnector.js'
import * as child from 'child_process';
import { v4 } from 'uuid'

const TYPEID = {
    ACTIVE_POWER_3P: "ACTIVE-POWER-3P",
    CHGSTATION_POWER: "CHGSTATION-POWER",
    ENERGY_COMMUNITY: "ENERGY-COMMUNITY",
    INSTALLED_PV_POWER: "INSTALLED-PV-POWER"
}

interface Node {
    id: string
    energyCommunity: "None" | "A" | "B"
    energyCommunityDynamic: string
}

interface Charger extends Node {
    chargingSetPointDynamic: string
    activePowerDynamic: string
    chargingSetPoint: number
}

interface PV extends Node {
    productionDynamic: string
    installedPVPowerDynamic: string
}

type storageEntry = {
    chargers: Charger[]
    pvs: PV[]
    numberOfMembers: Map<string, number>
}

const localStorage: Map<string, storageEntry> = new Map()
const logic = {

    initFn: (storyId: string, experimentId: string, state: TState, context: TModuleContext) => {
        context.log.write(`Init from [${storyId}/${experimentId}]`)

        let storageEntry = {
            chargers: [] as Charger[],
            pvs: [] as PV[],
            numberOfMembers: new Map()
        }

        storageEntry.numberOfMembers.set("A", 0)
        storageEntry.numberOfMembers.set("B", 0)

        localStorage[experimentId] = storageEntry

        for (const elementId of state.structures.ids) {
            if (state.structures.entities[elementId].experimentId == experimentId) {
                if (state.structures.entities[elementId].typeId == "CHARGING-POLE") {
                    const charger: Charger = { id: v4(), energyCommunity: "None", energyCommunityDynamic: "", chargingSetPointDynamic: "", activePowerDynamic: "", chargingSetPoint: 0 }
                    storageEntry.chargers.push(charger)

                    for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                        switch (state.dynamics.entities[dynamicID].typeId) {
                            case "ENERGY-COMMUNITY":
                                charger.energyCommunityDynamic = dynamicID
                                break
                            case TYPEID.CHGSTATION_POWER:
                                charger.chargingSetPointDynamic = dynamicID
                                break
                        }
                    }

                    const parentId = state.structures.entities[elementId].parentIds[0]
                    for (const dynamicID of state.structures.entities[parentId].dynamicIds) {
                        if (state.dynamics.entities[dynamicID].typeId == TYPEID.ACTIVE_POWER_3P) {
                            charger.activePowerDynamic = dynamicID
                        }
                    }
                }

                if (state.structures.entities[elementId].typeId == "SOLAR-PANEL") {
                    const pv: PV = { id: v4(), energyCommunity: "None", energyCommunityDynamic: "", productionDynamic: "", installedPVPowerDynamic: "" }
                    storageEntry.pvs.push(pv)

                    for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                        switch (state.dynamics.entities[dynamicID].typeId) {
                            case "ENERGY-COMMUNITY":
                                pv.energyCommunityDynamic = dynamicID
                                break
                            case TYPEID.ACTIVE_POWER_3P:
                                pv.productionDynamic = dynamicID
                                break
                            case TYPEID.INSTALLED_PV_POWER:
                                pv.installedPVPowerDynamic = dynamicID
                                break
                        }
                    }
                }
            }
        }

        return new DataFrame()
    },
    updateFn: (storyId: string, experimentId: string, startAt: number, simulationAt: number, replayAt: number, data: DataFrame, context: TModuleContext) => {
        context.log.write(`Update from [${storyId}/${experimentId}] @ ${simulationAt}`)

        var dynamicsById = {}
        if (!data.isEmpty()) {
            for (const dynamicObj of data.series) {
                dynamicsById[dynamicObj.dynamicId] = dynamicObj.values[0]
            }
        }


        const result: DataFrame = new DataFrame()
        result.setTime(simulationAt)

        const storageEntry = localStorage[experimentId]

        for (const charger of storageEntry.chargers) {
            const newEnergyCommunity = dynamicsById[charger.energyCommunityDynamic]
            const oldEnergyCommunity = charger.energyCommunity

            if (newEnergyCommunity != oldEnergyCommunity) {
                if (oldEnergyCommunity != "None") {
                    context.log.write(`stop charger with id: ${charger.id}`)

                    mqttConnector.unsubscribeChargingSetPoint(charger.id)
                    charger.chargingSetPoint = 0

                    // TODO: what to do if leader election node?
                    child.execSync(`docker stop ${charger.id}`)
                    child.execSync(`docker rm ${charger.id}`)

                    const newNumberOfMembers = storageEntry.numberOfMembers.get(oldEnergyCommunity)! - 1
                    storageEntry.numberOfMembers.set(oldEnergyCommunity, newNumberOfMembers)
                }

                if (newEnergyCommunity != "None") {
                    context.log.write(`start charger with id: ${charger.id} for energy community: ${newEnergyCommunity}`)

                    let childArguments: string[] = ["run", "-d", "--name", charger.id, "cr.siemens.com/openswarm/energy-community-controller/charger",
                        "-url", "tcp://host.docker.internal:1883", "-id", charger.id, "-energyCommunityId", newEnergyCommunity]

                    if (storageEntry.numberOfMembers.get(newEnergyCommunity) == 0) {
                        childArguments.push("-l")
                        childArguments.push("-b")
                    } else if (storageEntry.numberOfMembers.get(newEnergyCommunity)! < 3) {
                        childArguments.push("-l")
                    }

                    child.spawn("docker", childArguments)

                    mqttConnector.subscribeChargingSetPoint(charger.id, (chargingSetPoint => charger.chargingSetPoint = chargingSetPoint))
                    const newNumberOfMembers = storageEntry.numberOfMembers.get(newEnergyCommunity)! + 1
                    storageEntry.numberOfMembers.set(newEnergyCommunity, newNumberOfMembers)
                }

                charger.energyCommunity = newEnergyCommunity
            }

            result.addSeries({ dynamicId: charger.chargingSetPointDynamic, values: [charger.chargingSetPoint] })
        }

        for (const pv of storageEntry.pvs) {
            const newEnergyCommunity = dynamicsById[pv.energyCommunityDynamic]
            const oldEnergyCommunity = pv.energyCommunity

            if (newEnergyCommunity != oldEnergyCommunity) {
                if (oldEnergyCommunity != "None") {
                    context.log.write(`kill pv with id: ${pv.id}`)

                    // TODO: what to do if leader election node?
                    child.execSync(`docker stop ${pv.id}`)
                    child.execSync(`docker rm ${pv.id}`)

                    const newNumberOfMembers = storageEntry.numberOfMembers.get(oldEnergyCommunity)! - 1
                    storageEntry.numberOfMembers.set(oldEnergyCommunity, newNumberOfMembers)
                }

                if (newEnergyCommunity != "None") {
                    context.log.write(`start pv with ID id: ${pv.id} for energy community: ${newEnergyCommunity}`)

                    let childArguments: string[] = ["run", "-d", "--name", pv.id, "cr.siemens.com/openswarm/energy-community-controller/pv",
                        "-url", "tcp://host.docker.internal:1883", "-id", pv.id, "-energyCommunityId", newEnergyCommunity]

                    if (storageEntry.numberOfMembers.get(newEnergyCommunity) == 0) {
                        childArguments.push("-l")
                        childArguments.push("-b")
                    } else if (storageEntry.numberOfMembers.get(newEnergyCommunity)! < 3) {
                        childArguments.push("-l")
                    }

                    child.spawn("docker", childArguments)

                    const newNumberOfMembers = storageEntry.numberOfMembers.get(newEnergyCommunity)! + 1
                    storageEntry.numberOfMembers.set(newEnergyCommunity, newNumberOfMembers)
                }

                pv.energyCommunity = newEnergyCommunity
            }

            if (newEnergyCommunity != "None") {
                const production = dynamicsById[pv.productionDynamic]
                const installedPVPower = dynamicsById[pv.installedPVPowerDynamic]
                mqttConnector.publishPVProduction(pv.id, (production[0] + production[1] + production[2]) * installedPVPower)
            }
        }

        return result
    }
}

let mqttConnector = new MQTTConnector()
mqttConnector.connect("mqtt://localhost")

const m = new BifrostZeroModule({
    author: 'anonymous',
    label: 'EnergyCommunityControllerConnector',
    about: 'Energy community controller',
    initCallback: logic.initFn,
    updateCallback: logic.updateFn,
    fragmentFile: './fragment/EnergyCommunityControllerConnector.Fragment.yaml',
    subscriptions: [TYPEID.ACTIVE_POWER_3P, TYPEID.ENERGY_COMMUNITY, TYPEID.INSTALLED_PV_POWER],
    samplingRate: 900,
    moduleURL: process.env.MODULE_URL || 'http://localhost:1809',
    bifrostURL: process.env.BIFROST_URL || 'http://localhost:9091',
    hook: [300]
})
m.start()

process.on('SIGINT', function() {
    console.log("Shutting down");

    for (const storageEntry of localStorage.values()) {
        for (const charger of storageEntry.chargers) {
            if (charger.energyCommunity != "None") {
                child.execSync(`docker stop ${charger.id}`)
                child.execSync(`docker rm ${charger.id}`)
            }
        }

        for (const pv of storageEntry.pvs) {
            if (pv.energyCommunity != "None") {
                child.execSync(`docker stop ${pv.id}`)
                child.execSync(`docker rm ${pv.id}`)
            }
        }
    }

    process.exit()
});