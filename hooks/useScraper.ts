// Stubbed scraper for POC - will be replaced with real Reddit API integration later
export const useScraper = () => {
  const extractPostData = async (url: string): Promise<{ title: string; author: string; date: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock data based on URL patterns
    if (url.includes('askreddit')) {
      return {
        title: "What's the best life advice you've ever received?",
        author: 'u/AskRedditUser',
        date: new Date().toISOString()
      };
    } else if (url.includes('todayilearned')) {
      return {
        title: 'TIL that octopuses have three hearts and blue blood',
        author: 'u/TILUser',
        date: new Date().toISOString()
      };
    } else if (url.includes('programming')) {
      return {
        title: 'Best practices for React Native development in 2025',
        author: 'u/DevCoder',
        date: new Date().toISOString()
      };
    } else {
      // Default mock for any Reddit URL
      return {
        title: 'Interesting Reddit Post from URL',
        author: 'u/RedditUser',
        date: new Date().toISOString()
      };
    }
  };

  return { extractPostData };
};
