import { ESiteStatus, EWeatherCondition } from "@contractflow/contracts-schema"

export interface ISiteDailyLogEntity {
    contractId : string
    contractSiteId : string
    contractPartyId : string
    logDate : Date
    weatherCondition : EWeatherCondition
    temperatureCelsius : number
    weatherDelayMinutes : number
    workPerformed : string
    workPlannedNext : string
    issuesAndDelays : string
    status : ESiteStatus
    submittedAt : Date
    submittedById : string
    approvedAt : Date
    approvedById : string
    rejectionReason : string
}