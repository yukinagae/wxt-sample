export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Content script loaded');

    function extractPageContent() {
      const body = document.body;
      if (!body) return null;

      // Remove script tags, style tags, and other non-content elements
      const clone = body.cloneNode(true) as HTMLElement;
      
      // Remove unwanted elements
      const unwantedSelectors = [
        'script',
        'style',
        'noscript',
        'iframe',
        '[style*="display: none"]',
        '[style*="visibility: hidden"]',
        '.advertisement',
        '.ad',
        '.popup',
        '.modal',
        'nav',
        'header[role="banner"]',
        'footer[role="contentinfo"]'
      ];
      
      unwantedSelectors.forEach(selector => {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // Get clean text content
      let textContent = clone.textContent || clone.innerText || '';
      
      // Clean up whitespace
      textContent = textContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      return {
        textContent,
        title: document.title,
        url: window.location.href,
        timestamp: Date.now()
      };
    }

    // Listen for messages from sidepanel
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        const content = extractPageContent();
        sendResponse(content);
        return true; // Keep message channel open for async response
      }
    });
  },
});
