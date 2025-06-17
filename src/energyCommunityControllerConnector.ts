import { DataFrame, Log, TModuleContext, TState } from 'bifrost-zero-common'
import { BifrostZeroModule } from 'bifrost-zero-sdk'
import { MQTTConnector } from './mqttConnector.js'
import { ENERGYCOMMUNITY, StorageEntry, TYPEID, GRIDSENSORASSIGNMENT, GRIDSENSORNAME } from './types.js'
import { processInit } from './processInit.js'
import { processUpdate } from './processUpdate.js'
import { stopContainer } from './docker.js'

const localStorage: Map<string, StorageEntry> = new Map()
const logic = {

    initFn: (storyId: string, experimentId: string, state: TState, context: TModuleContext) => {
        context.log.write(`Init from [${storyId}/${experimentId}]`)

        try {   
            processInit(experimentId, localStorage, state)
        } catch (error) {
            if (error instanceof Error) {
                context.log.write(`Error: ${error.message}`, Log.level.ERROR)
                context.log.write(`Stack: ${error.stack}`, Log.level.ERROR)
            } else {
                context.log.write(`Unexpected error: ${error}`, Log.level.ERROR)
            }
        }


        return new DataFrame()
    },
    updateFn: (storyId: string, experimentId: string, startAt: number, simulationAt: number, replayAt: number, data: DataFrame, context: TModuleContext) => {
        context.log.write(`Update from [${storyId}/${experimentId}] @ ${simulationAt}`)

        try {   
            return processUpdate(experimentId, simulationAt, data, context, localStorage, mqttConnector)
        } catch (error) {
            if (error instanceof Error) {
                context.log.write(`Error: ${error.message}`, Log.level.ERROR)
                context.log.write(`Stack: ${error.stack}`, Log.level.ERROR)
            } else {
                context.log.write(`Unexpected error: ${error}`, Log.level.ERROR)
            }
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
    subscriptions: [
        TYPEID.PV_SYSTEM_POWER,
        TYPEID.CHGSTATION_POWER,
        TYPEID.ENERGY_COMMUNITY,
        TYPEID.GRID_SENSOR_NAME,
        TYPEID.GRID_SENSOR_ASSIGNMENT,
        TYPEID.GRID_SENSOR_POWERLIMIT,
        TYPEID.GRID_SENSOR_POWERMEASUREMENT
    ],
    samplingRate: process.env.SAMPLING_RATE ? Number(process.env.SAMPLING_RATE) : 900,
    moduleURL: process.env.MODULE_URL || 'http://localhost:1809',
    bifrostURL: process.env.BIFROST_URL || 'http://localhost:9091',
    hook: [300]
})
m.start()

process.on('SIGINT', function () {
    console.log("Shutting down and stopping docker containers. Please wait...");

    for (const storageEntry of localStorage.values()) {
        for (const node of storageEntry.chargers) {
            if (node.energyCommunity != ENERGYCOMMUNITY.NONE && node.gridSensorAssignment != GRIDSENSORASSIGNMENT.UNASSIGNED) {
                stopContainer(node.id)
            }
        }

        for (const node of storageEntry.pvs) {
            if (node.energyCommunity != ENERGYCOMMUNITY.NONE && node.gridSensorAssignment != GRIDSENSORASSIGNMENT.UNASSIGNED) {
                stopContainer(node.id)
            }
        }

        for (const sensor of storageEntry.sensors) {
            if (sensor.id != GRIDSENSORNAME.INACTIVE) {
                stopContainer(sensor.id)
            }
        }
    }

    mqttConnector.disconnect()
    process.exit()
});