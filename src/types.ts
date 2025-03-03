export const TYPEID = {
    ACTIVE_POWER_3P: "ACTIVE-POWER-3P",
    CHARGING_POLE: "CHARGING-POLE",
    CHGSTATION_POWER: "CHGSTATION-POWER",
    ENERGY_COMMUNITY: "ENERGY-COMMUNITY",
    SOLAR_PANEL: "SOLAR-PANEL"
}

export const ENERGYCOMMUNITY = {
    NONE: "None",
    A: "A",
    B: "B"
}

export interface Node {
    id: string
    energyCommunity: typeof ENERGYCOMMUNITY.NONE | typeof ENERGYCOMMUNITY.A | typeof ENERGYCOMMUNITY.B
    energyCommunityDynamic: string
    leaderElectionParticipant: boolean
    dockerImage: string
}

export interface Charger extends Node {
    chargingSetPointDynamic: string
    activePowerDynamic: string
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