"use client";

import { useState } from "react";
import { 
  Users, UserCheck, UserX, Shield, CheckCircle2, XCircle, 
  Search, RefreshCw, AlertCircle, Eye, ShieldAlert, GraduationCap, School
} from "lucide-react";
import { Badge, Dialog, Empty, ErrorBox, Loading, PageHeading, useData } from "@/components/ui";
import { send, date } from "@/lib/api";
import { AdminAccount, AdminAccountsResponse } from "@/lib/types";

export default function AdminAccountsPage() {
  const [tab, setTab] = useState<"all" | "pending" | "teacher" | "student" | "disabled">("pending");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);

  const queryPath = `/admin/accounts?page=${page}&size=50${search ? `&search=${encodeURIComponent(search)}` : ""}${tab !== "all" ? (tab === "teacher" || tab === "student" ? `&role=${tab}` : `&status=${tab}`) : ""}`;
  const { data, error, reload } = useData<AdminAccountsResponse>(queryPath);

  // Modals state
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve-teacher" | "approve-student" | "reject" | "disable" | "enable";
    account: AdminAccount;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  async function handleExecuteAction() {
    if (!confirmAction) return;
    setSubmitting(true);
    setActionError(null);
    setSuccessNotice(null);

    const { type, account } = confirmAction;
    try {
      if (type === "approve-teacher") {
        await send(`/admin/accounts/${account.id}/approve`, "POST", { role: "teacher" });
        setSuccessNotice(`Đã phê duyệt thành công tài khoản "${account.username}" (${account.email}) làm Giảng viên.`);
      } else if (type === "approve-student") {
        await send(`/admin/accounts/${account.id}/approve`, "POST", { role: "student" });
        setSuccessNotice(`Đã phê duyệt thành công tài khoản "${account.username}" (${account.email}) làm Học viên.`);
      } else if (type === "reject") {
        await send(`/admin/accounts/${account.id}/reject`, "POST");
        setSuccessNotice(`Đã từ chối đơn đăng ký của tài khoản "${account.username}".`);
      } else if (type === "disable") {
        await send(`/admin/accounts/${account.id}/disable`, "POST");
        setSuccessNotice(`Đã vô hiệu hóa tài khoản "${account.username}".`);
      } else if (type === "enable") {
        await send(`/admin/accounts/${account.id}/enable`, "POST");
        setSuccessNotice(`Đã kích hoạt lại tài khoản "${account.username}".`);
      }
      setConfirmAction(null);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Thao tác không thành công. Vui lòng thử lại.";
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(0);
  }

  return (
    <div className="admin-page">
      <PageHeading
        eyebrow="CỔNG QUẢN TRỊ VIÊN HỆ THỐNG"
        title="Quản lý tài khoản & Phê duyệt trực tuyến"
        description="Xem xét các tài khoản mới đăng ký qua Keycloak, phê duyệt phân quyền Giảng viên/Học viên và đồng bộ dữ liệu vào cơ sở dữ liệu."
        action={
          <button className="button secondary small" onClick={reload} aria-label="Làm mới danh sách">
            <RefreshCw size={15} aria-hidden="true" />
            Làm mới
          </button>
        }
      />

      {successNotice && (
        <div className="notice success" role="status" style={{ marginBottom: "20px" }}>
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>Thành công: </strong>
            <span>{successNotice}</span>
          </div>
          <button 
            type="button" 
            className="icon-button" 
            style={{ marginLeft: "auto", width: "24px", height: "24px", padding: 0 }} 
            onClick={() => setSuccessNotice(null)}
            aria-label="Đóng thông báo"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Metric summary counters */}
      {data && (
        <div className="overview-stats" style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginBottom: "24px" }}>
          <div>
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertCircle size={15} style={{ color: "#b87824" }} />
              Chờ phê duyệt
            </span>
            <strong style={{ color: data.pendingCount > 0 ? "#b87824" : "var(--ink)" }}>
              {data.pendingCount}
            </strong>
          </div>
          <div>
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <School size={15} style={{ color: "var(--green)" }} />
              Giảng viên
            </span>
            <strong>{data.teacherCount}</strong>
          </div>
          <div>
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <GraduationCap size={15} style={{ color: "#2357b7" }} />
              Học viên
            </span>
            <strong>{data.studentCount}</strong>
          </div>
          <div>
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <UserX size={15} style={{ color: "var(--error)" }} />
              Đã vô hiệu
            </span>
            <strong>{data.disabledCount}</strong>
          </div>
        </div>
      )}

      {/* Search Bar & Filter Tabs */}
      <div className="section-head" style={{ flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button 
            type="button" 
            className={`tab ${tab === "pending" ? "active" : ""}`}
            onClick={() => { setTab("pending"); setPage(0); }}
          >
            Chờ duyệt {data && data.pendingCount > 0 ? `(${data.pendingCount})` : ""}
          </button>
          <button 
            type="button" 
            className={`tab ${tab === "teacher" ? "active" : ""}`}
            onClick={() => { setTab("teacher"); setPage(0); }}
          >
            Giảng viên {data ? `(${data.teacherCount})` : ""}
          </button>
          <button 
            type="button" 
            className={`tab ${tab === "student" ? "active" : ""}`}
            onClick={() => { setTab("student"); setPage(0); }}
          >
            Học viên {data ? `(${data.studentCount})` : ""}
          </button>
          <button 
            type="button" 
            className={`tab ${tab === "disabled" ? "active" : ""}`}
            onClick={() => { setTab("disabled"); setPage(0); }}
          >
            Đã vô hiệu {data && data.disabledCount > 0 ? `(${data.disabledCount})` : ""}
          </button>
          <button 
            type="button" 
            className={`tab ${tab === "all" ? "active" : ""}`}
            onClick={() => { setTab("all"); setPage(0); }}
          >
            Tất cả {data ? `(${data.total})` : ""}
          </button>
        </div>

        <form className="search-form" onSubmit={handleSearchSubmit} style={{ maxWidth: "360px", width: "100%", margin: 0 }}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Tìm theo username, tên, email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Tìm kiếm người dùng"
          />
          <button type="submit" className="button small">Tìm</button>
        </form>
      </div>

      {error && <ErrorBox error={error} retry={reload} />}

      {!data && !error && <Loading text="Đang tải danh sách tài khoản từ Keycloak và máy chủ…" />}

      {data && data.items.length === 0 && (
        <Empty title="Không có tài khoản nào phù hợp">
          {tab === "pending"
            ? "Hiện tại không có tài khoản nào đang chờ phê duyệt."
            : search
            ? `Không tìm thấy kết quả phù hợp với từ khóa "${search}".`
            : "Chưa có tài khoản nào trong mục này."}
        </Empty>
      )}

      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Người dùng</th>
                <th scope="col">Email & Xác minh</th>
                <th scope="col">Vai trò</th>
                <th scope="col">Ngày đăng ký</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((acc) => {
                const isBootstrapAdmin = acc.email === "nhokuto12cdmt@gmail.com" || acc.username === "long";
                return (
                  <tr key={acc.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span className="avatar">
                          {acc.fullName.split(" ").filter(Boolean).at(-1)?.[0] || acc.username[0]?.toUpperCase() || "U"}
                        </span>
                        <div>
                          <strong>{acc.fullName}</strong>
                          <small className="muted">@{acc.username}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>{acc.email || "(Chưa có email)"}</span>
                        <div style={{ marginTop: "4px" }}>
                          {acc.emailVerified ? (
                            <Badge tone="success">Đã xác minh</Badge>
                          ) : (
                            <Badge tone="warm">Chờ duyệt</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {acc.assignedRole === "admin" ? (
                        <span className="badge" style={{ background: "#eef2ff", borderColor: "#c7d2fe", color: "#3730a3", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Shield size={12} aria-hidden="true" />
                          Quản trị viên
                        </span>
                      ) : acc.assignedRole === "teacher" ? (
                        <Badge tone="success">Giảng viên</Badge>
                      ) : acc.assignedRole === "student" ? (
                        <Badge>Học viên</Badge>
                      ) : (
                        <span className="badge" style={{ color: "var(--muted)" }}>Chưa gán</span>
                      )}
                    </td>
                    <td>
                      <small>
                        {acc.createdTimestamp ? date(new Date(acc.createdTimestamp).toISOString()) : "—"}
                      </small>
                    </td>
                    <td>
                      {acc.status === "pending" ? (
                        <Badge tone="warm">Chờ duyệt</Badge>
                      ) : acc.status === "disabled" ? (
                        <span className="badge" style={{ background: "var(--error-bg)", borderColor: "#fca5a5", color: "var(--error)" }}>
                          Đã khóa
                        </span>
                      ) : (
                        <Badge tone="success">Đang hoạt động</Badge>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          className="button small secondary"
                          style={{ minHeight: "36px", padding: "6px 10px" }}
                          onClick={() => setSelectedAccount(acc)}
                          title="Xem chi tiết tài khoản"
                        >
                          <Eye size={14} aria-hidden="true" />
                          Chi tiết
                        </button>

                        {/* Actions for Pending accounts */}
                        {acc.status === "pending" && (
                          <>
                            <button
                              type="button"
                              className="button small"
                              style={{ minHeight: "36px", padding: "6px 12px" }}
                              onClick={() => setConfirmAction({ type: "approve-teacher", account: acc })}
                            >
                              <School size={14} aria-hidden="true" />
                              Duyệt Giảng viên
                            </button>
                            <button
                              type="button"
                              className="button small secondary"
                              style={{ minHeight: "36px", padding: "6px 12px", borderColor: "var(--green)", color: "var(--green)" }}
                              onClick={() => setConfirmAction({ type: "approve-student", account: acc })}
                            >
                              <GraduationCap size={14} aria-hidden="true" />
                              Duyệt Học viên
                            </button>
                            <button
                              type="button"
                              className="button small secondary"
                              style={{ minHeight: "36px", padding: "6px 10px", borderColor: "#e7b9b1", color: "var(--error)" }}
                              onClick={() => setConfirmAction({ type: "reject", account: acc })}
                            >
                              Từ chối
                            </button>
                          </>
                        )}

                        {/* Actions for Approved accounts */}
                        {acc.status === "approved" && !isBootstrapAdmin && (
                          <button
                            type="button"
                            className="button small secondary"
                            style={{ minHeight: "36px", padding: "6px 10px", borderColor: "#e7b9b1", color: "var(--error)" }}
                            onClick={() => setConfirmAction({ type: "disable", account: acc })}
                          >
                            Khóa
                          </button>
                        )}

                        {/* Actions for Disabled accounts */}
                        {acc.status === "disabled" && (
                          <button
                            type="button"
                            className="button small secondary"
                            style={{ minHeight: "36px", padding: "6px 12px" }}
                            onClick={() => setConfirmAction({ type: "enable", account: acc })}
                          >
                            Mở khóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Account Details Dialog */}
      <Dialog
        open={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        title="Thông tin chi tiết tài khoản"
      >
        {selectedAccount && (
          <div className="account-details-modal">
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
              <span className="avatar" style={{ width: "48px", height: "48px", fontSize: "16px" }}>
                {selectedAccount.fullName.split(" ").filter(Boolean).at(-1)?.[0] || selectedAccount.username[0]?.toUpperCase()}
              </span>
              <div>
                <h3 style={{ fontSize: "18px", margin: 0 }}>{selectedAccount.fullName}</h3>
                <p className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>@{selectedAccount.username}</p>
              </div>
              <div style={{ marginLeft: "auto" }}>
                {selectedAccount.status === "pending" ? (
                  <Badge tone="warm">Chờ duyệt</Badge>
                ) : selectedAccount.status === "disabled" ? (
                  <span className="badge" style={{ background: "var(--error-bg)", borderColor: "#fca5a5", color: "var(--error)" }}>
                    Đã khóa
                  </span>
                ) : (
                  <Badge tone="success">Đang hoạt động</Badge>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "12px" }}>
              <div className="panel" style={{ padding: "16px" }}>
                <h4 style={{ fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Shield size={15} style={{ color: "var(--green)" }} />
                  Xác thực & Danh tính (Keycloak)
                </h4>
                <p><strong>Mã định danh (ID):</strong> <br/><span className="muted" style={{ wordBreak: "break-all", fontSize: "11px" }}>{selectedAccount.id}</span></p>
                <p style={{ marginTop: "8px" }}><strong>Email:</strong> {selectedAccount.email || "—"}</p>
                <p style={{ marginTop: "8px" }}><strong>Xác minh email:</strong> {selectedAccount.emailVerified ? "Đã xác minh (True)" : "Chờ xác minh (False)"}</p>
                <p style={{ marginTop: "8px" }}><strong>Trạng thái Keycloak:</strong> {selectedAccount.enabled ? "Enabled" : "Disabled"}</p>
                <p style={{ marginTop: "8px" }}><strong>Thời gian đăng ký:</strong> {selectedAccount.createdTimestamp ? date(new Date(selectedAccount.createdTimestamp).toISOString()) : "—"}</p>
              </div>

              <div className="panel" style={{ padding: "16px" }}>
                <h4 style={{ fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <School size={15} style={{ color: "var(--green)" }} />
                  Dữ liệu Học vụ (SQL Server)
                </h4>
                <p><strong>SQL UserId:</strong> {selectedAccount.sqlUserId ?? "(Chưa đồng bộ - Tài khoản chờ duyệt)"}</p>
                <p style={{ marginTop: "8px" }}><strong>Quyền Giảng viên (IsTeacher):</strong> {selectedAccount.isTeacher ? "Có (1)" : "Không (0)"}</p>
                <p style={{ marginTop: "8px" }}><strong>Quyền Học viên (IsStudent):</strong> {selectedAccount.isStudent ? "Có (1)" : "Không (0)"}</p>
                <p style={{ marginTop: "8px" }}><strong>Hoạt động (IsActive):</strong> {selectedAccount.sqlActive === null ? "—" : selectedAccount.sqlActive ? "Đang mở (1)" : "Đã khóa (0)"}</p>
              </div>
            </div>

            <div className="dialog-actions" style={{ marginTop: "24px" }}>
              <button type="button" className="button secondary" onClick={() => setSelectedAccount(null)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!confirmAction}
        onClose={() => { if (!submitting) { setConfirmAction(null); setActionError(null); } }}
        title={
          confirmAction?.type === "approve-teacher"
            ? "Xác nhận phê duyệt Giảng viên"
            : confirmAction?.type === "approve-student"
            ? "Xác nhận phê duyệt Học viên"
            : confirmAction?.type === "reject"
            ? "Xác nhận từ chối đơn đăng ký"
            : confirmAction?.type === "disable"
            ? "Xác nhận vô hiệu hóa tài khoản"
            : "Xác nhận kích hoạt lại tài khoản"
        }
      >
        {confirmAction && (
          <div>
            {actionError && (
              <div className="notice error" role="alert" style={{ marginBottom: "16px" }}>
                <AlertCircle size={18} aria-hidden="true" />
                <div><strong>Lỗi:</strong> {actionError}</div>
              </div>
            )}

            <p style={{ fontSize: "13px", lineHeight: "1.7" }}>
              {confirmAction.type === "approve-teacher" && (
                <>
                  Bạn có chắc chắn muốn phê duyệt tài khoản <strong>{confirmAction.account.fullName}</strong> (@{confirmAction.account.username}) làm <strong>Giảng viên</strong>?
                  <br /><br />
                  Hệ thống sẽ cấp vai trò Giảng viên trong Keycloak, đồng bộ danh tính vào bảng <code>dbo.Users</code> với <code>IsTeacher = 1</code>, và tự động tạo lớp học mẫu cho giảng viên nếu chưa có.
                </>
              )}
              {confirmAction.type === "approve-student" && (
                <>
                  Bạn có chắc chắn muốn phê duyệt tài khoản <strong>{confirmAction.account.fullName}</strong> (@{confirmAction.account.username}) làm <strong>Học viên</strong>?
                  <br /><br />
                  Hệ thống sẽ cấp vai trò Học viên trong Keycloak và đồng bộ danh tính vào bảng <code>dbo.Users</code> với <code>IsStudent = 1</code>. Học viên sau đó có thể được ghi danh vào các lớp học.
                </>
              )}
              {confirmAction.type === "reject" && (
                <>
                  Bạn có chắc chắn muốn từ chối tài khoản chờ duyệt <strong>{confirmAction.account.fullName}</strong> (@{confirmAction.account.username})?
                  <br /><br />
                  Tài khoản sẽ bị vô hiệu hóa đăng nhập trong Keycloak mà không xóa bản ghi lịch sử.
                </>
              )}
              {confirmAction.type === "disable" && (
                <>
                  Bạn có chắc chắn muốn vô hiệu hóa tài khoản <strong>{confirmAction.account.fullName}</strong> (@{confirmAction.account.username})?
                  <br /><br />
                  Người dùng sẽ bị khóa đăng nhập tại Keycloak và trạng thái trong bảng <code>dbo.Users</code> sẽ chuyển thành <code>IsActive = 0</code>.
                </>
              )}
              {confirmAction.type === "enable" && (
                <>
                  Bạn có chắc chắn muốn kích hoạt lại tài khoản <strong>{confirmAction.account.fullName}</strong> (@{confirmAction.account.username})?
                  <br /><br />
                  Tài khoản sẽ được mở khóa tại Keycloak và kích hoạt lại trong bảng <code>dbo.Users</code> (<code>IsActive = 1</code>).
                </>
              )}
            </p>

            <div className="dialog-actions" style={{ marginTop: "24px" }}>
              <button
                type="button"
                className="button secondary"
                disabled={submitting}
                onClick={() => { setConfirmAction(null); setActionError(null); }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={`button ${confirmAction.type === "reject" || confirmAction.type === "disable" ? "secondary danger-text" : ""}`}
                style={confirmAction.type === "reject" || confirmAction.type === "disable" ? { borderColor: "#e7b9b1" } : {}}
                disabled={submitting}
                onClick={handleExecuteAction}
              >
                {submitting ? "Đang xử lý…" : "Xác nhận thực hiện"}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
