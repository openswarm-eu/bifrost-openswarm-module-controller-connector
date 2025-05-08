export const TYPEID = {
    ACTIVE_POWER_3P      : "ACTIVE-POWER-3P",
    CHARGING_POLE        : "CHARGING-POLE",
    CHGSTATION_POWER     : "CHGSTATION-POWER",
    CHGSTATION_MAX_POWER : "CHGSTATION-MAX-POWER",
    SOLAR_PANEL          : "SOLAR-PANEL",
    PV_SYSTEM_POWER      : "PV-SYSTEM-POWER",
    ENERGY_COMMUNITY     : "ENERGY-COMMUNITY",
    POWERGRID_CONNECTOR  : "POWERGRID-CONNECTOR", 
}

export const ENERGYCOMMUNITY = {
    NONE : "None",
    A    : "A",
    B    : "B",
    C    : "C"
}

export interface Node {
    id: string
    energyCommunity: typeof ENERGYCOMMUNITY.NONE | typeof ENERGYCOMMUNITY.A | typeof ENERGYCOMMUNITY.B | typeof ENERGYCOMMUNITY.C
    energyCommunityDynamic: string
    leaderElectionParticipant: boolean
    dockerImage: string
}

export interface Charger extends Node {
    chargingSetPointDynamic: string
    chargingSetPoint: number
}

export interface PV extends Node {
    productionDynamic: string
}

export type StorageEntry = {
    chargers: Charger[]
    pvs: PV[]
    numberOfMembers: Map<string, number>
}

export const PV_SYSTEM_POWER_MAPPING = {
    Infeed_Potential : 0,
    Actual_Infeed    : 1,   
}

export const CHARGING_STATION_POWER_MAPPING = {
    Power_Demand : 0,
    Actual_Power : 1,
}
