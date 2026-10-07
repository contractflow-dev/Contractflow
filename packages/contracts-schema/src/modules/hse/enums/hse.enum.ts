export enum EHseCorrectiveActionPriority{
    LOW="low",
    MEDIUM="medium",
    HIGH="high"
}
export enum EHseActionStatus{
    OPEN="open",
    IN_PROGRESS="in_progress",
    CLOSED="closed"
}
export enum EHseIncidentPersonInvolvement{
    VICTIM = 'victim',
    INJURED_PERSON = 'injured_person',
    WITNESS = 'witness',
    REPORTER = 'reporter',
    SUPERVISOR = 'supervisor',
    FIRST_AIDER = 'first_aider',
    EMERGENCY_RESPONDER = 'emergency_responder',
    INVESTIGATOR = 'investigator',
    CONTRACTOR = 'contractor',
    VISITOR = 'visitor',
    OTHER = 'other'
}export enum EHseIncidentType{
    ACCIDENT="accident",
    NEAR_MISS="near_miss",
    HAZARD="hazard",
    ENVIRONMENTAL="environmental",
    SECURITY="security",
    OTHER="other"
}
export enum EHseSeverity{
    CRITICAL="critical",
    MAJOR="major",
    MINOR="minor",
    NEGLIGIBLE="negligible"
}
export enum EHseIncidentStatus{
    OPEN="open",
    IN_PROGRESS="in_progress",
    CLOSED="closed"
}
export enum EHseInpectionResult{
    COMPLIANT="compliant",
    NON_COMPLIANT="non_compliant",
    NOT_APPLICABLE="not_applicable"
}
export enum EHseInpectionRiskLevel{
    LOW="low",
    MEDIUM="medium",
    HIGH="high"
}
export enum EHseInspectionType{
    SAFETY="safety",
    ENVIRONMENTAL="environmental",
    HEALTH="health",
    OTHER="other"
}
export enum EHseInspectionStatus{
    PENDING="pending",
    IN_PROGRESS="in_progress",
    COMPLETED="completed",
    CANCELLED="cancelled"
}
export enum EHseOverallResult{
    PASS="pass",
    FAIL="fail",
    INCONCLUSIVE="inconclusive"
}