import { describe, expect, it } from 'vitest';
import type { HseIncident } from '../entities/hse-incident.entity';
import { toHseIncidentResponse } from './hse-response.dto';

/**
 * The people involved in an incident carry sensitive personal and medical
 * data (HSE_INCIDENT_PERSON: injury description, body part, treatment,
 * statement, phone number). No access rule for them is defined yet, so no
 * workspace response may include them.
 */
describe('HSE incident response', () => {
  const person = {
    id: 'person-1',
    firstName: 'Ada',
    lastName: 'Obi',
    phoneNumber: '+2348031234567',
    injuryDescription: 'Fractured left wrist',
    bodyPartAffected: 'Left wrist',
    treatmentGiven: 'Splint, hospital referral',
    statement: 'I slipped on the wet ramp.',
  };

  const incident = {
    id: 'inc-1',
    contractId: 'contract-1',
    contractSiteId: 'site-1',
    referenceNumber: 'INC-1',
    incidentType: 'injury',
    severity: 'serious',
    status: 'reported',
    occurredAt: new Date('2026-04-10T07:15:00Z'),
    locationDetail: 'Ramp B',
    description: 'Slip on wet ramp',
    immediateActionTaken: 'First aid given',
    rootCause: '',
    investigationSummary: '',
    lostTimeDays: 3,
    estimatedCostMinor: '250000',
    currencyCode: 'NGN',
    isNotifiable: true,
    authorityNotifiedAt: null,
    reportedAt: new Date('2026-04-10T08:00:00Z'),
    reportedById: 'cu-1',
    investigatedById: '',
    closedAt: null,
    closedById: '',
    createdAt: new Date('2026-04-10T08:00:00Z'),
    updatedAt: new Date('2026-04-10T08:00:00Z'),
    // As a future query might attach them.
    persons: [person],
    hseIncidentPersons: [person],
  } as unknown as HseIncident;

  it('never includes the people involved or their medical details', () => {
    const response = toHseIncidentResponse(incident);
    const json = JSON.stringify(response);

    expect(response).not.toHaveProperty('persons');
    expect(response).not.toHaveProperty('hseIncidentPersons');
    for (const value of Object.values(person)) {
      expect(json).not.toContain(value);
    }
  });

  it('reports the incident itself', () => {
    expect(toHseIncidentResponse(incident)).toMatchObject({
      referenceNumber: 'INC-1',
      severity: 'serious',
      lostTimeDays: 3,
      estimatedCostMinor: '250000',
      isNotifiable: true,
      authorityNotifiedAt: null,
      rootCause: null,
      investigatedById: null,
      occurredAt: '2026-04-10T07:15:00.000Z',
    });
  });
});
