import { useState } from "react"
import Button from "@mui/material/Button"
import DownloadIcon from "@mui/icons-material/Download"
import RefreshIcon from "@mui/icons-material/Refresh"
import { fetchReportAction, REPORTS } from "./lib"

// Generate/download panel for the Excel reports mysql_tables_sync_lambda
// writes to S3 (study_metrics, gtd_targets) -- not MySQL tables, so they
// don't fit QueryPanel's "run a query, show a table" shape.
//
// Generate calls trigger_regenerate (an async boto3 lambda.invoke against
// mysql_tables_sync_lambda); it returns before the new file exists, so the
// status line only confirms it was triggered. Download calls
// get_download_url (a presigned S3 URL for whatever copy currently exists)
// and starts the browser download immediately -- it does not wait for a
// Generate call to finish.
export default function ReportPanel({ queryApiBase }) {
  const [status, setStatus] = useState({}) // key -> { text, kind }
  const [busy, setBusy] = useState({}) // key -> true while a request is in flight

  const setReportStatus = (key, text, kind = "neutral") =>
    setStatus((prev) => ({ ...prev, [key]: { text, kind } }))

  const generate = async (key, label) => {
    setBusy((prev) => ({ ...prev, [key]: true }))
    setReportStatus(key, `Triggering ${label} regeneration…`)
    try {
      const data = await fetchReportAction(queryApiBase, "trigger_regenerate", {
        report: key,
      })
      const when = new Date(data.triggered_at).toLocaleTimeString()
      setReportStatus(
        key,
        `Triggered at ${when} — usually ready within a minute or two. Click Download when ready.`,
        "ok"
      )
    } catch (e) {
      setReportStatus(key, `Error: ${e.message}`, "err")
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }))
    }
  }

  const download = async (key, label) => {
    setBusy((prev) => ({ ...prev, [key]: true }))
    setReportStatus(key, "Fetching download link…")
    try {
      const data = await fetchReportAction(queryApiBase, "get_download_url", {
        report: key,
      })
      const when = new Date(data.last_modified).toLocaleString()
      setReportStatus(key, `Last generated: ${when}`, "ok")

      const a = document.createElement("a")
      a.href = data.url
      a.download = ""
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      setReportStatus(key, `Error: ${e.message}`, "err")
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="divide-y divide-gray-light/60">
      {REPORTS.map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div>
            <div className="text-sm font-semibold text-gray-dark">
              {r.label}
            </div>
            <div className="text-xs text-gray">{r.desc}</div>
            {status[r.key] && (
              <div
                className={`mt-1 text-xs ${
                  status[r.key].kind === "ok"
                    ? "text-emerald-600"
                    : status[r.key].kind === "err"
                    ? "text-red"
                    : "text-gray"
                }`}
              >
                {status[r.key].text}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              disabled={busy[r.key]}
              onClick={() => generate(r.key, r.label)}
            >
              Generate
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              disabled={busy[r.key]}
              onClick={() => download(r.key, r.label)}
            >
              Download
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
