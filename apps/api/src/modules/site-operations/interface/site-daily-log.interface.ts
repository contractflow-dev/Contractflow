import { SiteStatus, WeatherCondition } from "../entities/site-daily-log.entity"

export interface ISiteDailyLogEntity {
    contractId : string
    contractSiteId : string
    contractPartyId : string
    logDate : Date
    weatherCondition : WeatherCondition
    temperatureCelsius : number
    weatherDelayMinutes : number
    workPerformed : string
    workPlannedNext : string
    issuesAndDelays : string
    status : SiteStatus
    submittedAt : Date
    submittedById : string
    approvedAt : Date
    approvedById : string
    rejectionReason : string
}