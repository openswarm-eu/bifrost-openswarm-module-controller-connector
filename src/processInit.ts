import { TState } from 'bifrost-zero-common'
import { ENERGYCOMMUNITY, GRIDSENSORASSIGNMENT, Node, Charger, PV, Sensor, StorageEntry, TYPEID, SENSOR_MEMBER_KEY, GRIDSENSORNAME } from './types.js'
import { stopContainer } from './docker.js'
import { v4 } from 'uuid'

export function processInit(experimentId: string, localStorage: Map<string, StorageEntry>, state: TState) {
    if (localStorage.has(experimentId)) {
        const storageEntry = localStorage.get(experimentId)

        storageEntry!.chargers.filter(node => node.energyCommunity != ENERGYCOMMUNITY.NONE).forEach(ch => stopContainer(ch.id));
        storageEntry!.pvs.filter(node => node.energyCommunity != ENERGYCOMMUNITY.NONE).forEach(ch => stopContainer(ch.id));
        storageEntry!.sensors.filter(sensor => sensor.id != GRIDSENSORNAME.INACTIVE).forEach(sensor => stopContainer(sensor.id));
    }

    let storageEntry = {
        chargers: [] as Charger[],
        pvs: [] as PV[],
        sensors: [] as Sensor[],
        numberOfMembers: new Map()
    }

    Object.values(ENERGYCOMMUNITY).forEach(community => {
        storageEntry.numberOfMembers.set(community, 0)
    });
    storageEntry.numberOfMembers.set(SENSOR_MEMBER_KEY, 0)

    localStorage.set(experimentId, storageEntry)

    for (const elementId of state.structures.ids) {
        if (state.structures.entities[elementId].experimentId != experimentId) {
            continue
        }    

        switch (state.structures.entities[elementId].typeId) {
            case TYPEID.POWERGRID_CONNECTOR:
                const node: Node = {
                    id: v4(),
                    leaderElectionParticipant: false,
                    energyCommunity: ENERGYCOMMUNITY.NONE,
                    energyCommunityDynamic: "",
                    gridSensorAssignment: GRIDSENSORASSIGNMENT.UNASSIGNED,
                    gridSensorAssignmentDynamic: "",
                    dockerImage: "",
                    setPoint: 0,
                    setPointDynamic: "",
                    demandDynamic: "",
                }

                for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                    if (state.dynamics.entities[dynamicID].typeId == TYPEID.ENERGY_COMMUNITY) {
                        node.energyCommunityDynamic = dynamicID
                    } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.GRID_SENSOR_ASSIGNMENT) {
                        node.gridSensorAssignmentDynamic = dynamicID
                    }
                }

                for (const childId of state.structures.entities[elementId].childIds) {
                    if (state.structures.entities[childId]?.typeId == TYPEID.CHARGING_POLE) {
                        node.dockerImage = "cr.siemens.com/openswarm/energy-community-controller/charger"
                        storageEntry.chargers.push(node)

                        for (const dynamicID of state.structures.entities[childId].dynamicIds) {
                            if (state.dynamics.entities[dynamicID].typeId == TYPEID.CHGSTATION_MAX_POWER) {
                                node.setPointDynamic = dynamicID
                            } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.CHGSTATION_POWER) {
                                node.demandDynamic = dynamicID
                            }
                        }

                    
                    } else if (state.structures.entities[childId]?.typeId == TYPEID.SOLAR_PANEL) {
                        //node.id = "pv1"
                        node.dockerImage = "cr.siemens.com/openswarm/energy-community-controller/pv"
                        storageEntry.pvs.push(node)

                        for (const dynamicID of state.structures.entities[childId].dynamicIds) {
                            if (state.dynamics.entities[dynamicID].typeId == TYPEID.PV_SYSTEM_MAX_POWER) {
                                node.setPointDynamic = dynamicID
                            } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.PV_SYSTEM_POWER) {
                                node.demandDynamic = dynamicID
                            }
                        }
                    }
                }
                break;
            case TYPEID.GRID_SENSOR:
                const sensor: Sensor = {
                    id: GRIDSENSORNAME.INACTIVE,
                    dockerImage: "cr.siemens.com/openswarm/energy-community-controller/sensor",
                    leaderElectionParticipant: false,
                    gridSensorAssignment: GRIDSENSORASSIGNMENT.UNASSIGNED,
                    idDynamic: "",
                    gridSensorAssignmentDynamic: "",
                    powerLimit: 0,
                    powerLimitDynamic: "",
                    powerMeasurementDynamic: "",
                }

                storageEntry.sensors.push(sensor)

                for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                    if (state.dynamics.entities[dynamicID].typeId == TYPEID.GRID_SENSOR_NAME) {
                        sensor.idDynamic = dynamicID
                    } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.GRID_SENSOR_ASSIGNMENT) {
                        sensor.gridSensorAssignmentDynamic = dynamicID
                    } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.GRID_SENSOR_POWERLIMIT) {
                        sensor.powerLimitDynamic = dynamicID
                    } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.GRID_SENSOR_POWERMEASUREMENT) {
                        sensor.powerMeasurementDynamic = dynamicID
                    }
                }
        }    
    }
}