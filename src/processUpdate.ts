import { DataFrame, TModuleContext } from 'bifrost-zero-common'
import { MQTTConnector } from './mqttConnector.js'
import { 
    CHARGING_STATION_POWER_MAPPING, 
    ENERGYCOMMUNITY, 
    PV_SYSTEM_POWER_MAPPING, 
    StorageEntry
    } from './types.js'
import { stopNode, startNode } from './docker.js'

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
                } else if (storageEntry.numberOfMembers.get(charger.energyCommunity)! < 5) {
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

    }

    for (const pv of storageEntry.pvs) {
        const oldEnergyCommunity = pv.energyCommunity
        pv.energyCommunity = dynamicsById[pv.energyCommunityDynamic]

        if (pv.energyCommunity != oldEnergyCommunity) {
            if (oldEnergyCommunity != ENERGYCOMMUNITY.NONE) {
                context.log.write(`stop pv ${pv.id}`)

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
                } else if (storageEntry.numberOfMembers.get(pv.energyCommunity)! < 5) {
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
            mqttConnector.publishPVProduction(pv.id, production[PV_SYSTEM_POWER_MAPPING.Actual_Infeed])
        }
    }

    return result
}