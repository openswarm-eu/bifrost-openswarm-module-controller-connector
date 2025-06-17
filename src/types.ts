export const TYPEID = {
    ACTIVE_POWER_3P                 : "ACTIVE-POWER-3P",
    CHARGING_POLE                   : "CHARGING-POLE",
    CHGSTATION_POWER                : "CHGSTATION-POWER",
    CHGSTATION_MAX_POWER            : "CHGSTATION-MAX-POWER",
    SOLAR_PANEL                     : "SOLAR-PANEL",
    PV_SYSTEM_POWER                 : "PV-SYSTEM-POWER",
    PV_SYSTEM_MAX_POWER             : "PV-SYSTEM-MAX-POWER",
    ENERGY_COMMUNITY                : "ENERGY-COMMUNITY",
    POWERGRID_CONNECTOR             : "POWERGRID-CONNECTOR",
    GRID_SENSOR                     : "GRID-SENSOR",
    GRID_SENSOR_NAME                : "GRID-SENSOR-NAME",
    GRID_SENSOR_ASSIGNMENT          : "GRID-SENSOR-ASSIGNMENT",
    GRID_SENSOR_POWERLIMIT          : "GRID-SENSOR-POWERLIMIT",
    GRID_SENSOR_POWERMEASUREMENT    : "GRID-SENSOR-POWERMEASUREMENT",
}


export const ENERGYCOMMUNITY = {
    NONE : "None",
    A    : "A",
    B    : "B",
    C    : "C"
}

export const GRIDSENSORNAME = {
    INACTIVE: "Inactive",
    S1    : "S1",
    S2    : "S2",
    S3    : "S3",
    S4    : "S4",
    S5    : "S5",
    S6    : "S6",
    S7    : "S7",
    S8    : "S8",
    S9    : "S9",
}


export const GRIDSENSORASSIGNMENT = {
    UNASSIGNED : "Unassigned",
    S1    : "S1",
    S2    : "S2",
    S3    : "S3",
    S4    : "S4",
    S5    : "S5",
    S6    : "S6",
    S7    : "S7",
    S8    : "S8",
    S9    : "S9",
}

export const SENSOR_MEMBER_KEY = "sensors"

export interface Node {
    id: string
    dockerImage: string
    leaderElectionParticipant: boolean
    energyCommunity: typeof ENERGYCOMMUNITY.NONE | typeof ENERGYCOMMUNITY.A | typeof ENERGYCOMMUNITY.B | typeof ENERGYCOMMUNITY.C
    energyCommunityDynamic: string
    gridSensorAssignment: typeof GRIDSENSORASSIGNMENT.UNASSIGNED | typeof GRIDSENSORASSIGNMENT.S1 | typeof GRIDSENSORASSIGNMENT.S2 | typeof GRIDSENSORASSIGNMENT.S3 | typeof GRIDSENSORASSIGNMENT.S4 | 
                            typeof GRIDSENSORASSIGNMENT.S5 | typeof GRIDSENSORASSIGNMENT.S6 | typeof GRIDSENSORASSIGNMENT.S7 | typeof GRIDSENSORASSIGNMENT.S8 | typeof GRIDSENSORASSIGNMENT.S9
    gridSensorAssignmentDynamic: string
    setPoint: number
    setPointDynamic: string
    demandDynamic: string
}

export type Charger = Node
export type PV = Node

export interface Sensor {
    id: typeof GRIDSENSORNAME.INACTIVE | typeof GRIDSENSORNAME.S1 | typeof GRIDSENSORNAME.S2 | typeof GRIDSENSORNAME.S3 | typeof GRIDSENSORNAME.S4 | 
                            typeof GRIDSENSORNAME.S5 | typeof GRIDSENSORNAME.S6 | typeof GRIDSENSORNAME.S7 | typeof GRIDSENSORNAME.S8 | typeof GRIDSENSORNAME.S9
    dockerImage: string
    leaderElectionParticipant: boolean
    gridSensorAssignment: typeof GRIDSENSORASSIGNMENT.UNASSIGNED | typeof GRIDSENSORASSIGNMENT.S1 | typeof GRIDSENSORASSIGNMENT.S2 | typeof GRIDSENSORASSIGNMENT.S3 | typeof GRIDSENSORASSIGNMENT.S4 | 
                            typeof GRIDSENSORASSIGNMENT.S5 | typeof GRIDSENSORASSIGNMENT.S6 | typeof GRIDSENSORASSIGNMENT.S7 | typeof GRIDSENSORASSIGNMENT.S8 | typeof GRIDSENSORASSIGNMENT.S9
    idDynamic: string
    gridSensorAssignmentDynamic: string
    powerLimit: number
    powerLimitDynamic: string
    powerMeasurementDynamic: string
}

export type StorageEntry = {
    chargers: Charger[]
    pvs: PV[]
    sensors: Sensor[]
    numberOfMembers: Map<string, number>
}

export const PV_SYSTEM_POWER_MAPPING = {
    Infeed_Potential : 0,
    Actual_Infeed    : 1,   
}

export const CHARGING_STATION_POWER_MAPPING = {
    Power_Demand : 0,
    Actual_Power : 1,
    Shifted_Demand: 2,
}