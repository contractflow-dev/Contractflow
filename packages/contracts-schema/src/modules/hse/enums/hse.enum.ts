export enum HseCorrectiveActionPriority{
    LOW="low",
    MEDIUM="medium",
    HIGH="high"
}
export enum HseActionStatus{
    OPEN="open",
    IN_PROGRESS="in_progress",
    CLOSED="closed"
}
export enum HseIncidentPersonInvolvement{
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
}export enum HseIncidentType{
    ACCIDENT="accident",
    NEAR_MISS="near_miss",
    HAZARD="hazard",
    ENVIRONMENTAL="environmental",
    SECURITY="security",
    OTHER="other"
}
export enum HseSeverity{
    CRITICAL="critical",
    MAJOR="major",
    MINOR="minor",
    NEGLIGIBLE="negligible"
}
export enum HseIncidentStatus{
    OPEN="open",
    IN_PROGRESS="in_progress",
    CLOSED="closed"
}
export enum HseInpectionResult{
    COMPLIANT="compliant",
    NON_COMPLIANT="non_compliant",
    NOT_APPLICABLE="not_applicable"
}
export enum HseInpectionRiskLevel{
    LOW="low",
    MEDIUM="medium",
    HIGH="high"
}
export enum HseInspectionType{
    SAFETY="safety",
    ENVIRONMENTAL="environmental",
    HEALTH="health",
    OTHER="other"
}
export enum HseInspectionStatus{
    PENDING="pending",
    IN_PROGRESS="in_progress",
    COMPLETED="completed",
    CANCELLED="cancelled"
}
export enum HseOverallResult{
    PASS="pass",
    FAIL="fail",
    INCONCLUSIVE="inconclusive"
}