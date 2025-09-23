import React, { useState, useRef, useEffect } from 'react';
import { openaiService } from './openai-service';
import { pageContentService } from './page-content-service';
import './App.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isLoadingPageContent, setIsLoadingPageContent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentStreamingId = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    const initializeOpenAI = async () => {
      const initialized = await openaiService.initialize();
      setIsConfigured(initialized);
      if (!initialized) {
        setShowApiKeyInput(true);
      }
    };
    initializeOpenAI();
  }, []);

  const processBodyReference = async (message: string): Promise<string> => {
    if (!message.includes('@body')) {
      return message;
    }

    setIsLoadingPageContent(true);
    try {
      const pageContent = await pageContentService.getCurrentPageContent();
      
      if (!pageContent) {
        setIsLoadingPageContent(false);
        throw new Error('Could not retrieve page content. Make sure you have an active tab open.');
      }

      const formattedContent = pageContentService.formatContentForAI(pageContent);
      const processedMessage = message.replace(/@body/g, `the following page content:\n\n${formattedContent}`);
      
      setIsLoadingPageContent(false);
      return processedMessage;
    } catch (error) {
      setIsLoadingPageContent(false);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (!isConfigured) {
      alert('Please set your OpenAI API key first.');
      setShowApiKeyInput(true);
      return;
    }

    const originalInput = inputValue.trim();
    
    const newMessage: Message = {
      id: Date.now().toString(),
      content: originalInput,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);
    setStreamingMessage('');

    try {
      const processedInput = await processBodyReference(originalInput);
      
      const streamingId = Date.now().toString() + '_assistant';
      currentStreamingId.current = streamingId;

      const conversationHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      conversationHistory.push({ role: 'user', content: processedInput });

      let accumulatedMessage = '';
      
      await openaiService.sendMessageStream(
        conversationHistory,
        (chunk: string) => {
          if (currentStreamingId.current === streamingId) {
            accumulatedMessage += chunk;
            setStreamingMessage(accumulatedMessage);
          }
        },
        () => {
          if (currentStreamingId.current === streamingId) {
            const finalMessage: Message = {
              id: streamingId,
              content: accumulatedMessage,
              sender: 'assistant',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, finalMessage]);
            setStreamingMessage('');
            setIsTyping(false);
            currentStreamingId.current = null;
          }
        },
        (error: string) => {
          if (currentStreamingId.current === streamingId) {
            const errorMessage: Message = {
              id: streamingId,
              content: `Error: ${error}`,
              sender: 'assistant',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            setStreamingMessage('');
            setIsTyping(false);
            currentStreamingId.current = null;
          }
        }
      );
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString() + '_error',
        content: `Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`,
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
      setStreamingMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSetApiKey = async () => {
    if (!apiKey.trim()) return;
    
    const success = await openaiService.setApiKey(apiKey.trim());
    if (success) {
      setIsConfigured(true);
      setShowApiKeyInput(false);
      setApiKey('');
    } else {
      alert('Failed to set API key. Please try again.');
    }
  };

  const handleClearApiKey = async () => {
    if (confirm('Are you sure you want to clear the API key?')) {
      const success = await openaiService.clearApiKey();
      if (success) {
        setIsConfigured(false);
        setShowApiKeyInput(true);
      }
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>AI Assistant</h1>
        <div className="header-actions">
          {isConfigured ? (
            <button onClick={handleClearApiKey} className="settings-button" title="Clear API Key">
              ⚙️
            </button>
          ) : (
            <button onClick={() => setShowApiKeyInput(true)} className="settings-button" title="Set API Key">
              🔑
            </button>
          )}
        </div>
      </div>
      
      {showApiKeyInput && (
        <div className="api-key-input-container">
          <div className="api-key-input-wrapper">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenAI API Key"
              className="api-key-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSetApiKey();
                }
              }}
            />
            <button onClick={handleSetApiKey} className="api-key-set-button">
              Set
            </button>
            <button onClick={() => setShowApiKeyInput(false)} className="api-key-cancel-button">
              Cancel
            </button>
          </div>
          <p className="api-key-info">
            Your API key will be stored locally and encrypted. Get your key from{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
              OpenAI Platform
            </a>
          </p>
        </div>
      )}
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-avatar">
              {message.sender === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {(isTyping || streamingMessage) && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              {streamingMessage ? (
                <div className="message-text">{streamingMessage}</div>
              ) : (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
        {isLoadingPageContent && (
          <div className="loading-indicator">
            <span>Loading page content...</span>
          </div>
        )}
        
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message... (Use @body to reference current page content)"
            className="chat-input"
            rows={1}
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping || isLoadingPageContent}
            className="send-button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;