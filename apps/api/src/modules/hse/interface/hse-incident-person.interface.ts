import { EHseIncidentPersonInvolvement } from "@contractflow/contracts-schema"

export interface IHseIncidentPersonEntity {
    hseIncidentId : string
    companyUserId : string
    firstName : string
    lastName : string
    involvement : EHseIncidentPersonInvolvement
    employerName : string
    jobTitle : string
    phoneNumber : string
    injuryDescription : string
    bodyPartAffected : string
    treatmentGiven : string
    statement : string
}