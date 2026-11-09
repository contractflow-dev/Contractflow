import type {
  CreateCompanyDocumentUploadRequest,
  CreateDocumentUploadRequest,
  CreateDocumentVersionUploadRequest,
  DocumentDetail,
  DocumentDownloadUrl,
  DocumentSummary,
  DocumentUploadSession,
  IPaginatedResponse,
  IPaginationQuery,
} from "@contractflow/contracts-schema";
import { api, companyRoute, contractRoute } from "./api";

export type {
  CreateCompanyDocumentUploadRequest,
  CreateDocumentUploadRequest,
  CreateDocumentVersionUploadRequest,
  DocumentDetail,
  DocumentDownloadUrl,
  DocumentSummary,
  DocumentUploadSession,
} from "@contractflow/contracts-schema";

/**
 * Where the documents live: a contract the company is party to, or, with no
 * contract, the company's own private library.
 */
type ContractScope = { companyId: string; contractId?: string };
type DocumentScope = ContractScope & { documentId: string };

/** Contract routes for a contract's documents, company routes otherwise. */
function documentRoute({ companyId, contractId }: ContractScope, path = "") {
  return contractId
    ? contractRoute(companyId, contractId, `/documents${path}`)
    : companyRoute(companyId, `/documents${path}`);
}

const listTag = ({ companyId, contractId }: ContractScope) => ({
  type: "ContractDocument" as const,
  id: contractId ? `list:${contractId}` : `list:company:${companyId}`,
});

/**
 * Contract and company documents. Company and contract travel only in the
 * scope headers set by `contractRoute` and `companyRoute`. Upload and download URLs are short-lived bearer
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
          ...documentRoute({ companyId, contractId }),
          params,
        }),
        providesTags: (result, _error, { companyId, contractId }) => [
          listTag({ companyId, contractId }),
          ...(result?.data ?? []).map(({ id }) => ({
            type: "ContractDocument" as const,
            id,
          })),
        ],
      }),

      getContractDocument: builder.query<DocumentDetail, DocumentScope>({
        query: ({ companyId, contractId, documentId }) =>
          documentRoute({ companyId, contractId }, `/${documentId}`),
        providesTags: (_result, _error, { documentId }) => [
          { type: "ContractDocument", id: documentId },
        ],
      }),

      createDocumentUpload: builder.mutation<
        DocumentUploadSession,
        ContractScope & {
          body:
            CreateDocumentUploadRequest | CreateCompanyDocumentUploadRequest;
        }
      >({
        query: ({ companyId, contractId, body }) => ({
          ...documentRoute({ companyId, contractId }, "/upload-url"),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, _error, { companyId, contractId }) => [
          listTag({ companyId, contractId }),
        ],
      }),

      createDocumentVersionUpload: builder.mutation<
        DocumentUploadSession,
        DocumentScope & { body: CreateDocumentVersionUploadRequest }
      >({
        query: ({ companyId, contractId, documentId, body }) => ({
          ...documentRoute(
            { companyId, contractId },
            `/${documentId}/versions/upload-url`,
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
          ...documentRoute(
            { companyId, contractId },
            `/${documentId}/versions/${versionId}/complete`,
          ),
          method: "POST",
        }),
        invalidatesTags: (
          _result,
          _error,
          { companyId, contractId, documentId },
        ) => [
          listTag({ companyId, contractId }),
          { type: "ContractDocument", id: documentId },
        ],
      }),

      createDocumentDownloadUrl: builder.mutation<
        DocumentDownloadUrl,
        DocumentScope & { versionId?: string }
      >({
        query: ({ companyId, contractId, documentId, versionId }) => ({
          ...documentRoute(
            { companyId, contractId },
            `/${documentId}/download-url`,
          ),
          method: "GET",
          params: versionId ? { versionId } : undefined,
        }),
      }),

      deleteContractDocument: builder.mutation<void, DocumentScope>({
        query: ({ companyId, contractId, documentId }) => ({
          ...documentRoute({ companyId, contractId }, `/${documentId}`),
          method: "DELETE",
        }),
        // Only the list: refetching the deleted document itself would 404.
        invalidatesTags: (_result, _error, { companyId, contractId }) => [
          listTag({ companyId, contractId }),
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
