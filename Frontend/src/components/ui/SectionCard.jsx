/** Surface primitive for content groups, forms, and secondary page sections. */
export default function SectionCard({ children, className = "", as: Tag = "section" }) {
  return <Tag className={`ui-card ${className}`.trim()}>{children}</Tag>;
}
