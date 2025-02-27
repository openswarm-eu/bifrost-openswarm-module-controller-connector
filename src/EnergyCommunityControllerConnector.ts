import { DataFrame, TModuleContext, TState } from 'bifrost-zero-common'
import { BifrostZeroModule } from 'bifrost-zero-sdk'
import { MQTTConnector } from './MQTTConnector.js'
import * as child from 'child_process';
import { v4 } from 'uuid'

const TYPEID = {
    ACTIVE_POWER_3P: "ACTIVE-POWER-3P",
    CHARGING_POLE: "CHARGING-POLE",
    CHGSTATION_POWER: "CHGSTATION-POWER",
    ENERGY_COMMUNITY: "ENERGY-COMMUNITY",
    SOLAR_PANEL: "SOLAR-PANEL"
}

const ENERGYCOMMUNITY = {
    NONE: "None",
    A: "A",
    B: "B"
}

interface Node {
    id: string
    energyCommunity: typeof ENERGYCOMMUNITY.NONE | typeof ENERGYCOMMUNITY.A | typeof ENERGYCOMMUNITY.B
    energyCommunityDynamic: string
    leaderElectionParticipant: boolean
    dockerImage: string
}

interface Charger extends Node {
    chargingSetPointDynamic: string
    activePowerDynamic: string
    chargingSetPoint: number
}

interface PV extends Node {
    productionDynamic: string
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

        if (localStorage.has(experimentId)) {
            const storageEntry = localStorage.get(experimentId)

            storageEntry!.chargers.filter(ch => ch.energyCommunity != ENERGYCOMMUNITY.NONE).forEach(ch => stopNode(ch.id));
            storageEntry!.pvs.filter(pv => pv.energyCommunity != ENERGYCOMMUNITY.NONE).forEach(pv => stopNode(pv.id));
        }

        let storageEntry = {
            chargers: [] as Charger[],
            pvs: [] as PV[],
            numberOfMembers: new Map()
        }

        storageEntry.numberOfMembers.set(ENERGYCOMMUNITY.A, 0)
        storageEntry.numberOfMembers.set(ENERGYCOMMUNITY.B, 0)

        localStorage.set(experimentId, storageEntry)

        for (const elementId of state.structures.ids) {
            if (state.structures.entities[elementId].experimentId == experimentId) {
                if (state.structures.entities[elementId].typeId == TYPEID.CHARGING_POLE) {
                    const charger: Charger = {
                        id: v4(),
                        energyCommunity: ENERGYCOMMUNITY.NONE,
                        energyCommunityDynamic: "",
                        leaderElectionParticipant: false,
                        dockerImage: "cr.siemens.com/openswarm/energy-community-controller/charger",
                        chargingSetPointDynamic: "",
                        activePowerDynamic: "",
                        chargingSetPoint: 0
                    }
                    storageEntry.chargers.push(charger)

                    for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                        switch (state.dynamics.entities[dynamicID].typeId) {
                            case TYPEID.ENERGY_COMMUNITY:
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

                if (state.structures.entities[elementId].typeId == TYPEID.SOLAR_PANEL) {
                    const pv: PV = { 
                        id: v4(),
                        energyCommunity: ENERGYCOMMUNITY.NONE,
                        energyCommunityDynamic: "",
                        leaderElectionParticipant: false,
                        dockerImage: "cr.siemens.com/openswarm/energy-community-controller/pv",
                        productionDynamic: "" }
                    storageEntry.pvs.push(pv)

                    for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                        switch (state.dynamics.entities[dynamicID].typeId) {
                            case TYPEID.ENERGY_COMMUNITY:
                                pv.energyCommunityDynamic = dynamicID
                                break
                            case TYPEID.ACTIVE_POWER_3P:
                                pv.productionDynamic = dynamicID
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

        const storageEntry = localStorage.get(experimentId)
        if (storageEntry === undefined) {
            context.log.write("Got unknown experimentId. This should not happen!")
            return result
        }

        for (const charger of storageEntry.chargers) {
            const oldEnergyCommunity = charger.energyCommunity
            charger.energyCommunity = dynamicsById[charger.energyCommunityDynamic]

            if (charger.energyCommunity != oldEnergyCommunity) {
                if (oldEnergyCommunity != ENERGYCOMMUNITY.NONE) {
                    context.log.write(`stop charger ${charger.id}`)

                    mqttConnector.unsubscribeChargingSetPoint(charger.id)
                    charger.chargingSetPoint = 0

                    stopNode(charger.id)
                    const newNumberOfMembers = storageEntry.numberOfMembers.get(oldEnergyCommunity)! - 1
                    storageEntry.numberOfMembers.set(oldEnergyCommunity, newNumberOfMembers)

                    // if old node was part of leader election cluster, restart a node in same energy community to be part of leader election (if possible)
                    if (charger.leaderElectionParticipant) {
                        const newLeaderElectionParticipantNode = [...storageEntry.chargers, ...storageEntry.pvs].filter(node => node.energyCommunity == oldEnergyCommunity).find(node => !node.leaderElectionParticipant)
                        if (newLeaderElectionParticipantNode !== undefined) {
                            context.log.write(`${charger.id} was part of leader election cluster, restart ${newLeaderElectionParticipantNode.id} to replace it`)
                            stopNode(newLeaderElectionParticipantNode.id)

                            newLeaderElectionParticipantNode.leaderElectionParticipant = true
                            if (storageEntry.numberOfMembers.get(oldEnergyCommunity) == 1) {
                                startNode(newLeaderElectionParticipantNode, true)
                            } else {
                                startNode(newLeaderElectionParticipantNode, false)
                            }
                        }
                    }

                    charger.leaderElectionParticipant = false
                }

                if (charger.energyCommunity != ENERGYCOMMUNITY.NONE) {
                    context.log.write(`start charger ${charger.id} for energy community ${charger.energyCommunity}`)

                    if (storageEntry.numberOfMembers.get(charger.energyCommunity) == 0) {
                        charger.leaderElectionParticipant = true
                        startNode(charger, true)
                    } else if (storageEntry.numberOfMembers.get(charger.energyCommunity)! < 3) {
                        charger.leaderElectionParticipant = true
                        startNode(charger, false)
                    } else {
                        startNode(charger, false)
                    }

                    mqttConnector.subscribeChargingSetPoint(charger.id, (chargingSetPoint => charger.chargingSetPoint = chargingSetPoint))
                    const newNumberOfMembers = storageEntry.numberOfMembers.get(charger.energyCommunity)! + 1
                    storageEntry.numberOfMembers.set(charger.energyCommunity, newNumberOfMembers)
                }
            }

            result.addSeries({ dynamicId: charger.chargingSetPointDynamic, values: [charger.chargingSetPoint] })

            const activePower = dynamicsById[charger.activePowerDynamic]
            result.addSeries({ dynamicId: charger.activePowerDynamic, values: [[activePower[0] + charger.chargingSetPoint / 3, activePower[1] + charger.chargingSetPoint / 3, activePower[2] + charger.chargingSetPoint / 3]] })
        }

        for (const pv of storageEntry.pvs) {
            const oldEnergyCommunity = pv.energyCommunity
            pv.energyCommunity = dynamicsById[pv.energyCommunityDynamic]

            if (pv.energyCommunity != oldEnergyCommunity) {
                if (oldEnergyCommunity != ENERGYCOMMUNITY.NONE) {
                    context.log.write(`stop pv ${pv.id}`)

                    // TODO: what to do if leader election node?
                    stopNode(pv.id)
                    const newNumberOfMembers = storageEntry.numberOfMembers.get(oldEnergyCommunity)! - 1
                    storageEntry.numberOfMembers.set(oldEnergyCommunity, newNumberOfMembers)

                    // if old node was part of leader election cluster, restart a node in same energy community to be part of leader election (if possible)
                    if (pv.leaderElectionParticipant) {
                        const newLeaderElectionParticipantNode = [...storageEntry.chargers, ...storageEntry.pvs].filter(node => node.energyCommunity == oldEnergyCommunity).find(node => !node.leaderElectionParticipant)
                        if (newLeaderElectionParticipantNode !== undefined) {
                            context.log.write(`${pv.id} was part of leader election cluster, restart ${newLeaderElectionParticipantNode.id} to replace it`)
                            stopNode(newLeaderElectionParticipantNode.id)

                            newLeaderElectionParticipantNode.leaderElectionParticipant = true
                            if (storageEntry.numberOfMembers.get(oldEnergyCommunity) == 1) {
                                startNode(newLeaderElectionParticipantNode, true)
                            } else {
                                startNode(newLeaderElectionParticipantNode, false)
                            }
                        }
                    }

                    pv.leaderElectionParticipant = false
                }

                if (pv.energyCommunity != ENERGYCOMMUNITY.NONE) {
                    context.log.write(`start pv ${pv.id} for energy community ${pv.energyCommunity}`)
                    
                    if (storageEntry.numberOfMembers.get(pv.energyCommunity) == 0) {
                        pv.leaderElectionParticipant = true
                        startNode(pv, true)
                    } else if (storageEntry.numberOfMembers.get(pv.energyCommunity)! < 3) {
                        pv.leaderElectionParticipant = true
                        startNode(pv, false)
                    } else {
                        startNode(pv, false)
                    }

                    const newNumberOfMembers = storageEntry.numberOfMembers.get(pv.energyCommunity)! + 1
                    storageEntry.numberOfMembers.set(pv.energyCommunity, newNumberOfMembers)
                }
            }

            if (pv.energyCommunity != ENERGYCOMMUNITY.NONE) {
                const production = dynamicsById[pv.productionDynamic]
                mqttConnector.publishPVProduction(pv.id, production[0] + production[1] + production[2])
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
    subscriptions: [TYPEID.ACTIVE_POWER_3P, TYPEID.ENERGY_COMMUNITY],
    samplingRate: 900,
    moduleURL: process.env.MODULE_URL || 'http://localhost:1809',
    bifrostURL: process.env.BIFROST_URL || 'http://localhost:9091',
    hook: [300]
})
m.start()

process.on('SIGINT', function () {
    console.log("Shutting down and stopping docker containers. Please wait...");

    for (const storageEntry of localStorage.values()) {
        for (const charger of storageEntry.chargers) {
            if (charger.energyCommunity != ENERGYCOMMUNITY.NONE) {
                stopNode(charger.id)
            }
        }

        for (const pv of storageEntry.pvs) {
            if (pv.energyCommunity != ENERGYCOMMUNITY.NONE) {
                stopNode(pv.id)
            }
        }
    }

    mqttConnector.disconnect()
    process.exit()
});

function startNode(node:Node, boostrapNode:boolean) {
    let childArguments: string[] = ["run", "-d", "--name", node.id, node.dockerImage,
        "-url", "tcp://host.docker.internal:1883", "-id", node.id, "-energyCommunityId", node.energyCommunity]

    if (boostrapNode) {
        childArguments.push("-l")
        childArguments.push("-b")
    } else if (node.leaderElectionParticipant) {
        childArguments.push("-l")
    }

    child.spawn("docker", childArguments)
}

function stopNode(id: string) {
    child.execSync(`docker stop ${id}`)
    child.execSync(`docker rm ${id}`)
}