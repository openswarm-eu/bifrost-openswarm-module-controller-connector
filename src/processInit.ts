import { TState } from 'bifrost-zero-common'
import { ENERGYCOMMUNITY, GRIDSENSORASSIGNMENT, Node, Charger, PV, EnergyStorage, Sensor, StorageEntry, TYPEID, SENSOR_MEMBER_KEY, GRIDSENSORNAME } from './types.js'
import { killContainer } from './docker.js'
import { v4 } from 'uuid'

export function processInit(experimentId: string, localStorage: Map<string, StorageEntry>, state: TState) {
    if (localStorage.has(experimentId)) {
        const storageEntry = localStorage.get(experimentId)

        storageEntry!.chargers.filter(node => node.energyCommunity != ENERGYCOMMUNITY.NONE).forEach(ch => killContainer(ch.id));
        storageEntry!.pvs.filter(node => node.energyCommunity != ENERGYCOMMUNITY.NONE).forEach(pv => killContainer(pv.id));
        storageEntry!.energyStorage.filter(node => node.energyCommunity != ENERGYCOMMUNITY.NONE).forEach(es => killContainer(es.id));
        storageEntry!.sensors.filter(sensor => sensor.id != GRIDSENSORNAME.INACTIVE).forEach(sensor => killContainer(sensor.id));
    }

    let storageEntry = {
        chargers: [] as Charger[],
        pvs: [] as PV[],
        energyStorage: [] as EnergyStorage[],
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
                let energyCommunityDynamic
                let gridSensorAssignmentDynamic

                for (const dynamicID of state.structures.entities[elementId].dynamicIds) {
                    if (state.dynamics.entities[dynamicID].typeId == TYPEID.ENERGY_COMMUNITY) {
                        energyCommunityDynamic = dynamicID
                    } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.GRID_SENSOR_ASSIGNMENT) {
                        gridSensorAssignmentDynamic = dynamicID
                    }
                }

                for (const childId of state.structures.entities[elementId].childIds) {
                    if (state.structures.entities[childId]?.typeId == TYPEID.CHARGING_POLE) {
                        const charger: Charger = {
                            id: v4(),
                            leaderElectionParticipant: false,
                            energyCommunity: ENERGYCOMMUNITY.NONE,
                            energyCommunityDynamic: energyCommunityDynamic,
                            gridSensorAssignment: GRIDSENSORASSIGNMENT.UNASSIGNED,
                            gridSensorAssignmentDynamic: gridSensorAssignmentDynamic,
                            dockerImage: "cr.siemens.com/openswarm/energy-community-controller/charger",
                            setPoint: 0,
                            setPointDynamic: "",
                            demandDynamic: "",
                        }
                        storageEntry.chargers.push(charger)

                        for (const dynamicID of state.structures.entities[childId].dynamicIds) {
                            if (state.dynamics.entities[dynamicID].typeId == TYPEID.CHGSTATION_MAX_POWER) {
                                charger.setPointDynamic = dynamicID
                            } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.CHGSTATION_POWER) {
                                charger.demandDynamic = dynamicID
                            }
                        }

                    } else if (state.structures.entities[childId]?.typeId == TYPEID.SOLAR_PANEL) {
                        const pv: PV = {
                            id: v4(),
                            leaderElectionParticipant: false,
                            energyCommunity: ENERGYCOMMUNITY.NONE,
                            energyCommunityDynamic: energyCommunityDynamic,
                            gridSensorAssignment: GRIDSENSORASSIGNMENT.UNASSIGNED,
                            gridSensorAssignmentDynamic: gridSensorAssignmentDynamic,
                            dockerImage: "cr.siemens.com/openswarm/energy-community-controller/pv",
                            setPoint: 0,
                            setPointDynamic: "",
                            demandDynamic: "",
                        }
                        storageEntry.pvs.push(pv)

                        for (const dynamicID of state.structures.entities[childId].dynamicIds) {
                            if (state.dynamics.entities[dynamicID].typeId == TYPEID.PV_SYSTEM_MAX_POWER) {
                                pv.setPointDynamic = dynamicID
                            } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.PV_SYSTEM_POWER) {
                                pv.demandDynamic = dynamicID
                            }
                        }
                        
                    } else if (state.structures.entities[childId]?.typeId == TYPEID.BATTERY_SYSTEM) {
                        const energyStorage: EnergyStorage = {
                            id: v4(),
                            leaderElectionParticipant: false,
                            energyCommunity: ENERGYCOMMUNITY.NONE,
                            energyCommunityDynamic: energyCommunityDynamic,
                            gridSensorAssignment: GRIDSENSORASSIGNMENT.UNASSIGNED,
                            gridSensorAssignmentDynamic: gridSensorAssignmentDynamic,
                            dockerImage: "cr.siemens.com/openswarm/energy-community-controller/storage",
                            chargeSetPoint: 0,
                            dischargeSetPoint: 0,
                            setPointDynamic: "",
                            potentialDynamic: "",
                        }
                        storageEntry.energyStorage.push(energyStorage)

                        for (const dynamicID of state.structures.entities[childId].dynamicIds) {
                            if (state.dynamics.entities[dynamicID].typeId == TYPEID.BATTERY_SYSTEM_MAX_POWER) {
                                energyStorage.setPointDynamic = dynamicID
                            } else if (state.dynamics.entities[dynamicID].typeId == TYPEID.BATTERY_SYSTEM_POWER) {
                                energyStorage.potentialDynamic = dynamicID
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