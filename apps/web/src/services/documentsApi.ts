import type {
  CreateDocumentUploadRequest,
  CreateDocumentVersionUploadRequest,
  DocumentDetail,
  DocumentDownloadUrl,
  DocumentSummary,
  DocumentUploadSession,
  IPaginatedResponse,
  IPaginationQuery,
} from "@contractflow/contracts-schema";
import { api, contractRoute } from "./api";

export type {
  CreateDocumentUploadRequest,
  CreateDocumentVersionUploadRequest,
  DocumentDetail,
  DocumentDownloadUrl,
  DocumentSummary,
  DocumentUploadSession,
} from "@contractflow/contracts-schema";

type ContractScope = { companyId: string; contractId: string };
type DocumentScope = ContractScope & { documentId: string };

const listTag = (contractId: string) => ({
  type: "ContractDocument" as const,
  id: `list:${contractId}`,
});

/**
 * Contract documents. Company and contract travel only in the scope headers
 * set by `contractRoute`. Upload and download URLs are short-lived bearer
 * credentials, so they come from mutations and are never cached.
 */
export const documentsApi = api
  .enhanceEndpoints({ addTagTypes: ["ContractDocument"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getContractDocuments: builder.query<
        IPaginatedResponse<DocumentSummary>,
        ContractScope & IPaginationQuery
      >({
        query: ({ companyId, contractId, ...params }) => ({
          ...contractRoute(companyId, contractId, "/documents"),
          params,
        }),
        providesTags: (result, _error, { contractId }) => [
          listTag(contractId),
          ...(result?.data ?? []).map(({ id }) => ({
            type: "ContractDocument" as const,
            id,
          })),
        ],
      }),

      getContractDocument: builder.query<DocumentDetail, DocumentScope>({
        query: ({ companyId, contractId, documentId }) =>
          contractRoute(companyId, contractId, `/documents/${documentId}`),
        providesTags: (_result, _error, { documentId }) => [
          { type: "ContractDocument", id: documentId },
        ],
      }),

      createDocumentUpload: builder.mutation<
        DocumentUploadSession,
        ContractScope & { body: CreateDocumentUploadRequest }
      >({
        query: ({ companyId, contractId, body }) => ({
          ...contractRoute(companyId, contractId, "/documents/upload-url"),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, _error, { contractId }) => [
          listTag(contractId),
        ],
      }),

      createDocumentVersionUpload: builder.mutation<
        DocumentUploadSession,
        DocumentScope & { body: CreateDocumentVersionUploadRequest }
      >({
        query: ({ companyId, contractId, documentId, body }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/documents/${documentId}/versions/upload-url`,
          ),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, _error, { documentId }) => [
          { type: "ContractDocument", id: documentId },
        ],
      }),

      completeDocumentUpload: builder.mutation<
        DocumentDetail,
        DocumentScope & { versionId: string }
      >({
        query: ({ companyId, contractId, documentId, versionId }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/documents/${documentId}/versions/${versionId}/complete`,
          ),
          method: "POST",
        }),
        invalidatesTags: (_result, _error, { contractId, documentId }) => [
          listTag(contractId),
          { type: "ContractDocument", id: documentId },
        ],
      }),

      createDocumentDownloadUrl: builder.mutation<
        DocumentDownloadUrl,
        DocumentScope & { versionId?: string }
      >({
        query: ({ companyId, contractId, documentId, versionId }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/documents/${documentId}/download-url`,
          ),
          method: "GET",
          params: versionId ? { versionId } : undefined,
        }),
      }),

      deleteContractDocument: builder.mutation<void, DocumentScope>({
        query: ({ companyId, contractId, documentId }) => ({
          ...contractRoute(companyId, contractId, `/documents/${documentId}`),
          method: "DELETE",
        }),
        invalidatesTags: (_result, _error, { contractId, documentId }) => [
          listTag(contractId),
          { type: "ContractDocument", id: documentId },
        ],
      }),
    }),
  });

export const {
  useGetContractDocumentsQuery,
  useGetContractDocumentQuery,
  useCreateDocumentUploadMutation,
  useCreateDocumentVersionUploadMutation,
  useCompleteDocumentUploadMutation,
  useCreateDocumentDownloadUrlMutation,
  useDeleteContractDocumentMutation,
} = documentsApi;
