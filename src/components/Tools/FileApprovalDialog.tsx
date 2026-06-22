import { useState } from 'react'
import { PendingToolCall } from '../../types'
import styles from './FileApprovalDialog.module.css'

interface Props {
  toolCalls: PendingToolCall[]
  onApprove: (approved: PendingToolCall[], rejected: PendingToolCall[]) => void
  onRejectAll: () => void
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', rs: 'Rust', go: 'Go', css: 'CSS', html: 'HTML',
    json: 'JSON', md: 'Markdown', sh: 'Shell', toml: 'TOML', yaml: 'YAML',
    txt: 'Text',
  }
  return map[ext] ?? ext.toUpperCase()
}

function getToolIcon(name: string) {
  if (name === 'create_file') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  if (name === 'read_file') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
  return null
}

export default function FileApprovalDialog({ toolCalls, onApprove, onRejectAll }: Props) {
  const [rejected, setRejected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleReject(id: string) {
    setRejected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleApprove() {
    const approvedList = toolCalls.filter(tc => !rejected.has(tc.id))
    const rejectedList = toolCalls.filter(tc => rejected.has(tc.id))
    onApprove(approvedList, rejectedList)
  }

  const allRejected = rejected.size === toolCalls.length

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className={styles.title}>Permission Required</h2>
            <p className={styles.subtitle}>
              The AI wants to perform {toolCalls.length === 1 ? 'an action' : `${toolCalls.length} actions`} on your computer
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          {toolCalls.map(tc => {
            const isRejected = rejected.has(tc.id)
            const isExpanded = expanded.has(tc.id)
            const isCreate = tc.name === 'create_file'
            const isRead = tc.name === 'read_file'
            const content = tc.parsedArgs.content ?? ''
            const path = tc.parsedArgs.path ?? ''
            const description = tc.parsedArgs.description ?? ''
            const lines = content.split('\n').length
            const lang = getLanguage(path)

            return (
              <div key={tc.id} className={`${styles.action} ${isRejected ? styles.actionRejected : ''}`}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionIcon}>
                    {getToolIcon(tc.name)}
                  </div>
                  <div className={styles.actionInfo}>
                    <div className={styles.actionTitle}>
                      {isCreate ? 'Create file' : 'Read file'}
                      {lang && <span className={styles.langBadge}>{lang}</span>}
                    </div>
                    <div className={styles.actionPath}>{path}</div>
                    {description && (
                      <div className={styles.actionDesc}>{description}</div>
                    )}
                  </div>
                  <div className={styles.actionControls}>
                    {isCreate && (
                      <button
                        className={styles.previewBtn}
                        onClick={() => toggleExpand(tc.id)}
                      >
                        {isExpanded ? 'Hide' : `Preview (${lines} lines)`}
                      </button>
                    )}
                    <button
                      className={`${styles.toggleBtn} ${isRejected ? styles.toggleBtnRejected : ''}`}
                      onClick={() => toggleReject(tc.id)}
                    >
                      {isRejected ? 'Skipped' : 'Allow'}
                    </button>
                  </div>
                </div>

                {isExpanded && content && (
                  <div className={styles.codeBlock}>
                    <pre className={styles.code}>{content}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.footer}>
          <button className={styles.rejectBtn} onClick={onRejectAll}>
            Cancel all
          </button>
          <button
            className={styles.approveBtn}
            onClick={handleApprove}
            disabled={allRejected}
          >
            {allRejected
              ? 'Nothing to run'
              : rejected.size > 0
              ? `Run ${toolCalls.length - rejected.size} of ${toolCalls.length}`
              : `Run ${toolCalls.length === 1 ? 'action' : `all ${toolCalls.length} actions`}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}