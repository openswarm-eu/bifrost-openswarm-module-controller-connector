import { DataFrame, Log, TModuleContext, TState } from 'bifrost-zero-common'
import { BifrostZeroModule } from 'bifrost-zero-sdk'
import { MQTTConnector } from './mqttConnector.js'
import { ENERGYCOMMUNITY, StorageEntry, TYPEID } from './types.js'
import { processInit } from './processInit.js'
import { processUpdate } from './processUpdate.js'
import { stopNode } from './docker.js'

const localStorage: Map<string, StorageEntry> = new Map()
const logic = {

    initFn: (storyId: string, experimentId: string, state: TState, context: TModuleContext) => {
        context.log.write(`Init from [${storyId}/${experimentId}]`)

        try {   
            processInit(experimentId, localStorage, state)
        } catch (error) {
            context.log.write(`Error: ${error}`, Log.level.ERROR)
        }


        return new DataFrame()
    },
    updateFn: (storyId: string, experimentId: string, startAt: number, simulationAt: number, replayAt: number, data: DataFrame, context: TModuleContext) => {
        context.log.write(`Update from [${storyId}/${experimentId}] @ ${simulationAt}`)

        try {   
            return processUpdate(experimentId, simulationAt, data, context, localStorage, mqttConnector)
        } catch (error) {
            context.log.write(`Error: ${error}`, Log.level.ERROR)
        }

        const result: DataFrame = new DataFrame()
        result.setTime(simulationAt)
        return result
    }
}

let mqttConnector = new MQTTConnector()
mqttConnector.connect(process.env.MQTT_URL || 'mqtt://localhost')

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