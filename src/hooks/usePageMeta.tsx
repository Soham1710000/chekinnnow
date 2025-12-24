import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export const usePageMeta = ({ title, description, image, url }: PageMeta) => {
  useEffect(() => {
    // Store original values
    const originalTitle = document.title;
    const originalMeta: Record<string, string | null> = {};
    
    const metaTags = [
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "description", content: description },
      ...(image ? [
        { property: "og:image", content: image },
        { name: "twitter:image", content: image },
      ] : []),
      ...(url ? [{ property: "og:url", content: url }] : []),
    ];

    // Update document title
    document.title = title;

    // Update or create meta tags
    metaTags.forEach(({ property, name, content }) => {
      const selector = property 
        ? `meta[property="${property}"]` 
        : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement | null;
      
      if (meta) {
        originalMeta[selector] = meta.getAttribute("content");
        meta.setAttribute("content", content);
      } else {
        meta = document.createElement("meta");
        if (property) meta.setAttribute("property", property);
        if (name) meta.setAttribute("name", name);
        meta.setAttribute("content", content);
        document.head.appendChild(meta);
        originalMeta[selector] = null; // Mark as newly created
      }
    });

    // Cleanup: restore original values
    return () => {
      document.title = originalTitle;
      Object.entries(originalMeta).forEach(([selector, originalContent]) => {
        const meta = document.querySelector(selector) as HTMLMetaElement | null;
        if (meta) {
          if (originalContent === null) {
            meta.remove();
          } else {
            meta.setAttribute("content", originalContent);
          }
        }
      });
    };
  }, [title, description, image, url]);
};
