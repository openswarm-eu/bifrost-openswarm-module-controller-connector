import { TState } from 'bifrost-zero-common'
import { Charger, ENERGYCOMMUNITY, PV, StorageEntry, TYPEID } from './types.js'
import { stopNode } from './docker.js'
import { v4 } from 'uuid'

export function processInit(experimentId: string, localStorage: Map<string, StorageEntry>, state: TState) {
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

    Object.values(ENERGYCOMMUNITY).forEach(community => {
        storageEntry.numberOfMembers.set(community, 0)
    });

    localStorage.set(experimentId, storageEntry)

    for (const elementId of state.structures.ids) {
        if (state.structures.entities[elementId].experimentId != experimentId) {
            continue
        }    

        if (state.structures.entities[elementId].typeId != TYPEID.POWERGRID_CONNECTOR) {
            continue
        }

        for (const childId of state.structures.entities[elementId].childIds) {
            if (state.structures.entities[childId]?.typeId == TYPEID.CHARGING_POLE) {
                const charger: Charger = {
                    id: v4(),
                    energyCommunity: ENERGYCOMMUNITY.NONE,
                    energyCommunityDynamic: "",
                    leaderElectionParticipant: false,
                    dockerImage: "cr.siemens.com/openswarm/energy-community-controller/charger",
                    chargingSetPointDynamic: "",
                    chargingSetPoint: 0
                }
                storageEntry.chargers.push(charger)

                for (const dynamicID of state.structures.entities[childId].dynamicIds) {
                    if (state.dynamics.entities[dynamicID].typeId == TYPEID.CHGSTATION_POWER) {
                        charger.chargingSetPointDynamic = dynamicID
                        break
                    }
                }

                for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                    if (state.dynamics.entities[dynamicID].typeId == TYPEID.ENERGY_COMMUNITY) {
                        charger.energyCommunityDynamic = dynamicID
                    }
                }
            } else if (state.structures.entities[childId]?.typeId == TYPEID.SOLAR_PANEL) {
                const pv: PV = { 
                    id: v4(),
                    energyCommunity: ENERGYCOMMUNITY.NONE,
                    energyCommunityDynamic: "",
                    leaderElectionParticipant: false,
                    dockerImage: "cr.siemens.com/openswarm/energy-community-controller/pv",
                    productionDynamic: "" }
                storageEntry.pvs.push(pv)

                for (const dynamicID of state.structures.entities[childId].dynamicIds) {
                    if (state.dynamics.entities[dynamicID].typeId == TYPEID.PV_SYSTEM_POWER) {
                        pv.productionDynamic = dynamicID
                        break
                    }
                }

                for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                    if (state.dynamics.entities[dynamicID].typeId == TYPEID.ENERGY_COMMUNITY) {
                        pv.energyCommunityDynamic = dynamicID
                        break
                    }
                }
            }
        }
    }
}