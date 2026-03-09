import { useState } from 'react';

interface CodeSnippetProps {
  code: string;
  title?: string;
}

function CodeSnippet({ code, title = 'Código de instalación' }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="code-snippet">
      <div className="code-snippet-header">
        <span className="code-snippet-title">{title}</span>
        <button className="code-snippet-copy" onClick={handleCopy}>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <div className="code-snippet-body">
        <pre>{code}</pre>
      </div>
    </div>
  );
}

export default CodeSnippet;
