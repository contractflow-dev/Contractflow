import { HseIncidentPersonInvolvement } from "../entities/hse-incident-person.entity"

export interface IHseIncidentPersonEntity {
    hseIncidentId : string
    companyUserId : string
    firstName : string
    lastName : string
    involvement : HseIncidentPersonInvolvement
    employerName : string
    jobTitle : string
    phoneNumber : string
    injuryDescription : string
    bodyPartAffected : string
    treatmentGiven : string
    statement : string
}