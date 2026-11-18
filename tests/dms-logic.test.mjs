import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_PERMISSIONS,
  computeDocumentCompleteness,
  enforceCompletenessGatekeeper,
  transitionWorkflowState
} from '../public/dms-core.mjs';

const sampleReqs = [
  { requirement_id: 'R1', document_type_id: 'DT-RES', requirement_name: 'Session Attendance Sheet', is_mandatory: true },
  { requirement_id: 'R2', document_type_id: 'DT-RES', requirement_name: 'Minutes of Session', is_mandatory: true },
  { requirement_id: 'R3', document_type_id: 'DT-RES', requirement_name: 'Signed Resolution Draft', is_mandatory: true },
  { requirement_id: 'R4', document_type_id: 'DT-RES', requirement_name: 'Optional Annex Photo', is_mandatory: false }
];

test('computeDocumentCompleteness calculates mandatory percentage accurately', () => {
  const partialAttachments = [
    { document_id: 'D1', requirement_id: 'R1', file_name: 'attendance.pdf' },
    { document_id: 'D1', requirement_id: 'R2', file_name: 'minutes.pdf' }
  ];
  const res1 = computeDocumentCompleteness('DT-RES', sampleReqs, partialAttachments, 'D1');
  assert.equal(res1.mandatoryTotal, 3);
  assert.equal(res1.mandatorySatisfied, 2);
  assert.equal(res1.isMandatoryComplete, false);
  assert.equal(res1.percentage, 67);

  const fullAttachments = [
    ...partialAttachments,
    { document_id: 'D1', requirement_id: 'R3', file_name: 'draft.pdf' }
  ];
  const res2 = computeDocumentCompleteness('DT-RES', sampleReqs, fullAttachments, 'D1');
  assert.equal(res2.mandatorySatisfied, 3);
  assert.equal(res2.isMandatoryComplete, true);
  assert.equal(res2.percentage, 100);
});

test('enforceCompletenessGatekeeper blocks For Review when mandatory files are missing', () => {
  const gated = enforceCompletenessGatekeeper('For Review', false);
  assert.equal(gated.allowedStatus, 'Draft');
  assert.equal(gated.gated, true);

  const allowed = enforceCompletenessGatekeeper('For Review', true);
  assert.equal(allowed.allowedStatus, 'For Review');
  assert.equal(allowed.gated, false);
});

test('transitionWorkflowState enforces revision remarks, version increments, and wet-signed archival', () => {
  const doc = {
    document_id: 'DOC-2026-005',
    ref_no: 'SK-PROP-2026-005',
    status: 'For Review',
    current_version: 1,
    uploaded_by: 'USR-OFF'
  };

  assert.throws(() => {
    transitionWorkflowState(doc, 'REQUEST_REVISION', { remarks: '   ' });
  }, /Revision remarks are mandatory/);

  const revResult = transitionWorkflowState(doc, 'REQUEST_REVISION', {
    remarks: 'Attach CENRO Iligan bamboo site endorsement.',
    reviewer_id: 'USR-CHAIR'
  });
  assert.equal(revResult.nextStatus, 'For Revision');
  assert.equal(revResult.reviewEntry.review_status, 'For Revision');

  const uploadRev = transitionWorkflowState(
    { ...doc, status: revResult.nextStatus, current_version: 1 },
    'UPLOAD_REVISION',
    { remarks: 'Added CENRO endorsement scan.' }
  );
  assert.equal(uploadRev.nextStatus, 'For Review');
  assert.equal(uploadRev.nextVersion, 2);
  assert.equal(uploadRev.versionEntry.version_number, '2.0');

  const approved = transitionWorkflowState(
    { ...doc, status: 'For Review', current_version: 2 },
    'APPROVE',
    { remarks: 'Complete and verified.' }
  );
  assert.equal(approved.nextStatus, 'Approved');

  assert.throws(() => {
    transitionWorkflowState({ ...doc, status: 'Draft' }, 'ARCHIVE_SIGNED', { signed_file: 'signed.pdf' });
  }, /must be Approved/);

  const archived = transitionWorkflowState(
    { ...doc, status: 'Approved', current_version: 2 },
    'ARCHIVE_SIGNED',
    { signed_file: 'SK-PROP-2026-005_WetSigned.pdf' }
  );
  assert.equal(archived.nextStatus, 'Archived');
  assert.equal(archived.signedCopyFile, 'SK-PROP-2026-005_WetSigned.pdf');
});

test('ROLE_PERMISSIONS isolates Reviewer, Officer/Treasurer, and SystemAdmin capabilities', () => {
  assert.equal(ROLE_PERMISSIONS.SKTreasurer.canReviewApprove, false);
  assert.equal(ROLE_PERMISSIONS.SKReviewer.canReviewApprove, true);
  assert.equal(ROLE_PERMISSIONS.SKReviewer.canManageChecklists, false);
  assert.equal(ROLE_PERMISSIONS.SystemAdmin.canManageChecklists, true);
  assert.equal(ROLE_PERMISSIONS.SystemAdmin.canDelete, true);
});
