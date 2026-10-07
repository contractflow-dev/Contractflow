export enum EContractSiteStatus{
    PLANNED = 'planned',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    COMPLETED = 'completed',
    CLOSED = 'closed'
}
export enum ETransactionType {
    RECEIPT = 'receipt',
    ISSUE = 'issue',
    ADJUSTMENT = 'adjustment',
    TRANSFER = 'transfer',
    RETURN = 'return'
}
export enum EEquipmentCondition{
    EXCELLENT = 'excellent',
    GOOD = 'good',
    FAIR = 'fair',
    POOR = 'poor',
    DAMAGED = 'damaged',
    REPAIR_REQUIRED = 'repair_required',
    OUT_OF_SERVICE = 'out_of_service',
    IDLE = 'idle',
    OPERATING = 'operating',
    STANDBY = 'standby'
}
export enum EWeatherCondition {
    CLEAR = "clear",
    CLOUDY = "cloudy",
    PARTLY_CLOUDY = "partly_cloudy",
    RAINY = "rainy",
    HEAVY_RAIN = "heavy_rain",
    WINDY = "windy",
    STORMY = "stormy",
    FOGGY = "foggy",
    HOT = "hot",
    COLD = "cold",
    SNOWY = "snowy",
    HAIL = "hail"
}
export enum ESiteStatus {
    ON_SCHEDULE = "on_schedule",
    AHEAD_OF_SCHEDULE = "ahead_of_schedule",
    BEHIND_SCHEDULE = "behind_schedule",
    DELAYED = "delayed",
    SUSPENDED = "suspended",
    COMPLETED = "completed",
    AT_RISK = "at_risk",
    HOLD = "hold",
    CLOSED = "closed"
}