/** Surface primitive for content groups, forms, and secondary page sections. */
export default function SectionCard({ children, className = "", as: Tag = "section", ...props }) {
  return <Tag {...props} className={`ui-card ${className}`.trim()}>{children}</Tag>;
}
