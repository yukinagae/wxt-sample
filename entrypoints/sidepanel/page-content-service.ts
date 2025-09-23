interface PageContent {
  textContent: string;
  title: string;
  url: string;
  timestamp: number;
}

class PageContentService {
  private cachedContent: PageContent | null = null;

  async getCurrentPageContent(): Promise<PageContent | null> {
    try {
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      if (!activeTab?.id) {
        console.warn('No active tab found');
        return null;
      }

      // Send message to content script to get page content
      const content = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'GET_PAGE_CONTENT'
      }) as PageContent;

      if (content) {
        this.cachedContent = content;
        return content;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get page content:', error);
      return null;
    }
  }

  getCachedContent(): PageContent | null {
    return this.cachedContent;
  }

  clearCache(): void {
    this.cachedContent = null;
  }

  formatContentForAI(content: PageContent, maxLength: number = 8000): string {
    let formattedContent = `Page Title: ${content.title}\n`;
    formattedContent += `URL: ${content.url}\n`;
    formattedContent += `Content:\n${content.textContent}`;

    // Truncate if too long, keeping the most important parts
    if (formattedContent.length > maxLength) {
      const titleAndUrl = `Page Title: ${content.title}\nURL: ${content.url}\nContent:\n`;
      const availableLength = maxLength - titleAndUrl.length - 50; // Leave some buffer
      
      // Take content from the beginning and add truncation notice
      const truncatedContent = content.textContent.substring(0, availableLength);
      formattedContent = titleAndUrl + truncatedContent + '\n\n[Content truncated due to length...]';
    }

    return formattedContent;
  }
}

export const pageContentService = new PageContentService();