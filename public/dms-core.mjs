// Pure relational state & compliance engine for SK Barangay Pugaan DMS
// Shared between unit tests and the browser application

export const ROLE_PERMISSIONS = {
  SKTreasurer: {
    label: 'SK Treasurer',
    canCreate: true,
    canEditDraft: true,
    canSubmitForReview: true,
    canUploadRevision: true,
    canReviewApprove: false,
    canUploadSignedCopy: true,
    canManageChecklists: false,
    canDelete: false
  },
  SKOfficer: {
    label: 'SK Officer',
    canCreate: true,
    canEditDraft: true,
    canSubmitForReview: true,
    canUploadRevision: true,
    canReviewApprove: false,
    canUploadSignedCopy: true,
    canManageChecklists: false,
    canDelete: false
  },
  SKReviewer: {
    label: 'SK Reviewer / Chairperson',
    canCreate: true,
    canEditDraft: true,
    canSubmitForReview: true,
    canUploadRevision: false,
    canReviewApprove: true,
    canUploadSignedCopy: true,
    canManageChecklists: false,
    canDelete: false
  },
  SystemAdmin: {
    label: 'System Administrator',
    canCreate: true,
    canEditDraft: true,
    canSubmitForReview: true,
    canUploadRevision: true,
    canReviewApprove: true,
    canUploadSignedCopy: true,
    canManageChecklists: true,
    canDelete: true
  }
};

export function computeDocumentCompleteness(docTypeId, requirementsList, docRequirementsList, documentId) {
  const typeReqs = requirementsList.filter(r => r.document_type_id === docTypeId);
  const mandatoryReqs = typeReqs.filter(r => r.is_mandatory);
  const attachedForDoc = docRequirementsList.filter(
    dr => dr.document_id === documentId && dr.file_name && dr.file_name.trim().length > 0
  );

  const attachedReqIds = new Set(attachedForDoc.map(dr => dr.requirement_id));
  const mandatorySatisfied = mandatoryReqs.filter(r => attachedReqIds.has(r.requirement_id)).length;
  const totalSatisfied = typeReqs.filter(r => attachedReqIds.has(r.requirement_id)).length;

  const isMandatoryComplete = mandatorySatisfied >= mandatoryReqs.length;
  const percentage = mandatoryReqs.length === 0
    ? 100
    : Math.round((mandatorySatisfied / mandatoryReqs.length) * 100);

  return {
    mandatoryTotal: mandatoryReqs.length,
    mandatorySatisfied,
    totalReqs: typeReqs.length,
    totalSatisfied,
    isMandatoryComplete,
    percentage
  };
}

export function enforceCompletenessGatekeeper(requestedStatus, isMandatoryComplete) {
  if (!isMandatoryComplete && requestedStatus !== 'Draft') {
    return {
      allowedStatus: 'Draft',
      gated: true,
      reason: 'Mandatory DILG/LYDO requirements are incomplete. Saved as Draft.'
    };
  }
  return {
    allowedStatus: requestedStatus,
    gated: false,
    reason: null
  };
}

export function transitionWorkflowState(doc, action, payload = {}) {
  const currentVersion = Number(doc.current_version || 1);

  if (action === 'REQUEST_REVISION') {
    const remarks = (payload.remarks || '').trim();
    if (!remarks) {
      throw new Error('Revision remarks are mandatory when requesting a revision.');
    }
    return {
      nextStatus: 'For Revision',
      nextVersion: currentVersion,
      reviewEntry: {
        review_id: `REV-${Date.now()}`,
        document_id: doc.document_id,
        reviewer_id: payload.reviewer_id || 'USR-CHAIR',
        review_status: 'For Revision',
        remarks,
        review_date: payload.date || '2026-11-17'
      }
    };
  }

  if (action === 'UPLOAD_REVISION') {
    const nextVersion = currentVersion + 1;
    return {
      nextStatus: 'For Review',
      nextVersion,
      versionEntry: {
        version_id: `VER-${Date.now()}`,
        document_id: doc.document_id,
        version_number: `${nextVersion}.0`,
        file_path: payload.file_path || `${doc.ref_no}_v${nextVersion}.pdf`,
        file_size: payload.file_size || '1.15 MB',
        revision_remarks: payload.remarks || `Uploaded revised v${nextVersion}.0 addressing reviewer remarks.`,
        uploaded_by: payload.uploaded_by || doc.uploaded_by,
        uploaded_at: payload.date || '2026-11-17'
      }
    };
  }

  if (action === 'APPROVE') {
    return {
      nextStatus: 'Approved',
      nextVersion: currentVersion,
      reviewEntry: {
        review_id: `REV-${Date.now()}`,
        document_id: doc.document_id,
        reviewer_id: payload.reviewer_id || 'USR-CHAIR',
        review_status: 'Approved',
        remarks: (payload.remarks || '').trim() || 'Verified compliant with DILG/LYDO requirements. Approved for physical wet signature.',
        review_date: payload.date || '2026-11-17'
      }
    };
  }

  if (action === 'ARCHIVE_SIGNED') {
    if (doc.status !== 'Approved' && doc.status !== 'Submitted to DILG/LYDO') {
      throw new Error('Document must be Approved before uploading wet-signed final archive copy.');
    }
    const signedFile = (payload.signed_file || '').trim();
    if (!signedFile) {
      throw new Error('Wet-signed PDF file name is required to complete archival.');
    }
    return {
      nextStatus: 'Archived',
      nextVersion: currentVersion,
      signedCopyFile: signedFile
    };
  }

  throw new Error(`Unsupported workflow action: ${action}`);
}
