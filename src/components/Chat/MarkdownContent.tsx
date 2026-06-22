import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import styles from './MarkdownContent.module.css'

interface Props {
  content: string
}

export default function MarkdownContent({ content }: Props) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '')
            const isBlock = match || codeString.includes('\n')

            if (isBlock) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match?.[1] || 'text'}
                  PreTag="div"
                  customStyle={{
                    margin: '8px 0',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              )
            }

            return (
              <code className={styles.inlineCode} {...props}>
                {children}
              </code>
            )
          },

          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" className={styles.link}>
                {children}
              </a>
            )
          },

          table({ children }) {
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>{children}</table>
              </div>
            )
          },

          blockquote({ children }) {
            return <blockquote className={styles.blockquote}>{children}</blockquote>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}