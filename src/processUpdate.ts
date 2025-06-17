import { DataFrame, TModuleContext } from 'bifrost-zero-common'
import { MQTTConnector } from './mqttConnector.js'
import { 
    ENERGYCOMMUNITY, 
    CHARGING_STATION_POWER_MAPPING,
    PV_SYSTEM_POWER_MAPPING,
    StorageEntry,
    GRIDSENSORASSIGNMENT,
    SENSOR_MEMBER_KEY,
    GRIDSENSORNAME,
    Node
    } from './types.js'
import { stopContainer, startNode, startSensor } from './docker.js'

export function processUpdate(experimentId: string, simulationAt: number, data: DataFrame, context: TModuleContext, localStorage:Map<string, StorageEntry>, mqttConnector: MQTTConnector){
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
        startStopNode(charger, storageEntry, dynamicsById, context, mqttConnector)
        
        if (charger.energyCommunity != ENERGYCOMMUNITY.NONE && charger.gridSensorAssignment != GRIDSENSORASSIGNMENT.UNASSIGNED) {
            const demand = dynamicsById[charger.demandDynamic]
            mqttConnector.publishDemand(charger.id, demand[CHARGING_STATION_POWER_MAPPING.Shifted_Demand])
        }

        result.addSeries({ dynamicId: charger.setPointDynamic, values: [charger.setPoint] })
    }

    for (const pv of storageEntry.pvs) {
        startStopNode(pv, storageEntry, dynamicsById, context, mqttConnector)
        
        if (pv.energyCommunity != ENERGYCOMMUNITY.NONE && pv.gridSensorAssignment != GRIDSENSORASSIGNMENT.UNASSIGNED) {
            const demand = dynamicsById[pv.demandDynamic]
            mqttConnector.publishDemand(pv.id, demand[PV_SYSTEM_POWER_MAPPING.Infeed_Potential])
        }

        result.addSeries({ dynamicId: pv.setPointDynamic, values: [pv.setPoint] })
    }

    for (const sensor of storageEntry.sensors) {
        const oldId = sensor.id
        sensor.id = dynamicsById[sensor.idDynamic]
        const oldGridSensorAssignment = sensor.gridSensorAssignment
        sensor.gridSensorAssignment = dynamicsById[sensor.gridSensorAssignmentDynamic]
        const oldPowerLimit = sensor.powerLimit
        sensor.powerLimit = dynamicsById[sensor.powerLimitDynamic]

        if (sensor.id != oldId || sensor.gridSensorAssignment != oldGridSensorAssignment || sensor.powerLimit != oldPowerLimit) {
            if (oldId != GRIDSENSORNAME.INACTIVE) {
                context.log.write(`stop sensor ${oldId}`)

                stopContainer(oldId)
                const newNumberOfMembers = storageEntry.numberOfMembers.get(SENSOR_MEMBER_KEY)! - 1
                storageEntry.numberOfMembers.set(SENSOR_MEMBER_KEY, newNumberOfMembers)

                // if old sensor was part of leader election cluster, restart a node in same energy community to be part of leader election (if possible)
                if (sensor.leaderElectionParticipant) {
                    const newLeaderElectionParticipantNode = storageEntry.sensors.find(node => !node.leaderElectionParticipant)
                    if (newLeaderElectionParticipantNode !== undefined) {
                        context.log.write(`${sensor.id} was part of leader election cluster, restart ${newLeaderElectionParticipantNode.id} to replace it`)
                        stopContainer(newLeaderElectionParticipantNode.id)

                        newLeaderElectionParticipantNode.leaderElectionParticipant = true
                        if (storageEntry.numberOfMembers.get(SENSOR_MEMBER_KEY) == 1) {
                            startSensor(newLeaderElectionParticipantNode, true)
                        } else {
                            startSensor(newLeaderElectionParticipantNode, false)
                        }
                    }
                }

                sensor.leaderElectionParticipant = false
            }

            if (sensor.id != GRIDSENSORNAME.INACTIVE) {
                context.log.write(`start sensor ${sensor.id}`)

                if (storageEntry.numberOfMembers.get(SENSOR_MEMBER_KEY) == 0) {
                    sensor.leaderElectionParticipant = true
                    startSensor(sensor, true)
                } else if (storageEntry.numberOfMembers.get(SENSOR_MEMBER_KEY)! < 5) {
                    sensor.leaderElectionParticipant = true
                    startSensor(sensor, false)
                } else {
                    startSensor(sensor, false)
                }

                const newNumberOfMembers = storageEntry.numberOfMembers.get(SENSOR_MEMBER_KEY)! + 1
                storageEntry.numberOfMembers.set(SENSOR_MEMBER_KEY, newNumberOfMembers)
            }
        }

        if (sensor.id != GRIDSENSORNAME.INACTIVE) {
            const powerMeasurement = dynamicsById[sensor.powerMeasurementDynamic]
            mqttConnector.publishPowerMeasurement(sensor.id, powerMeasurement)
         }
    }

    return result
}

function startStopNode(node: Node, storageEntry: StorageEntry, dynamicsById: any, context: TModuleContext, mqttConnector: MQTTConnector) {
    const oldEnergyCommunity = node.energyCommunity
        const oldGridSensorAssignment = node.gridSensorAssignment
        node.energyCommunity = dynamicsById[node.energyCommunityDynamic]
        node.gridSensorAssignment = dynamicsById[node.gridSensorAssignmentDynamic]

        if (node.energyCommunity != oldEnergyCommunity || node.gridSensorAssignment != oldGridSensorAssignment) {
            if (oldEnergyCommunity != ENERGYCOMMUNITY.NONE && oldGridSensorAssignment != GRIDSENSORASSIGNMENT.UNASSIGNED) {
                context.log.write(`stop node ${node.id}`)

                mqttConnector.unsubscribeSetPoint(node.id)
                node.setPoint = 0

                stopContainer(node.id)
                const newNumberOfMembers = storageEntry.numberOfMembers.get(oldEnergyCommunity)! - 1
                storageEntry.numberOfMembers.set(oldEnergyCommunity, newNumberOfMembers)

                // if old node was part of leader election cluster, restart a node in same energy community to be part of leader election (if possible)
                if (node.leaderElectionParticipant) {
                    const newLeaderElectionParticipantNode = [...storageEntry.chargers, ...storageEntry.pvs].filter(node => node.energyCommunity == oldEnergyCommunity).find(node => !node.leaderElectionParticipant)
                    if (newLeaderElectionParticipantNode !== undefined) {
                        context.log.write(`${node.id} was part of leader election cluster, restart ${newLeaderElectionParticipantNode.id} to replace it`)
                        stopContainer(newLeaderElectionParticipantNode.id)

                        newLeaderElectionParticipantNode.leaderElectionParticipant = true
                        if (storageEntry.numberOfMembers.get(oldEnergyCommunity) == 1) {
                            startNode(newLeaderElectionParticipantNode, true)
                        } else {
                            startNode(newLeaderElectionParticipantNode, false)
                        }
                    }
                }

                node.leaderElectionParticipant = false
            }

            if (node.energyCommunity != ENERGYCOMMUNITY.NONE && node.gridSensorAssignment != GRIDSENSORASSIGNMENT.UNASSIGNED) {
                context.log.write(`start node ${node.id} for energy community ${node.energyCommunity}`)

                if (storageEntry.numberOfMembers.get(node.energyCommunity) == 0) {
                    node.leaderElectionParticipant = true
                    startNode(node, true)
                } else if (storageEntry.numberOfMembers.get(node.energyCommunity)! < 5) {
                    node.leaderElectionParticipant = true
                    startNode(node, false)
                } else {
                    startNode(node, false)
                }

                mqttConnector.subscribeSetPoint(node.id, (setPoint => node.setPoint = setPoint))

                const newNumberOfMembers = storageEntry.numberOfMembers.get(node.energyCommunity)! + 1
                storageEntry.numberOfMembers.set(node.energyCommunity, newNumberOfMembers)
            }
        }
}