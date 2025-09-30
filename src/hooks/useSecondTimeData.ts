import { useState, useEffect } from 'react';
import { secondTimeApi } from '@/services/secondTimeApi';
import type { UserTimeData } from '@/services/secondTimeApi';

export const useSecondTimeData = (email: string | undefined) => {
  const [data, setData] = useState<UserTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!email) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const timeData = await secondTimeApi.getUserTimeData(email);
      setData(timeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch time data');
      console.error('Error fetching time data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [email]);

  const refetch = () => {
    fetchData();
  };

  return {
    data,
    isLoading,
    error,
    refetch
  };
};
