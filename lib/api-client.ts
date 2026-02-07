// API Client - Thin fetch wrapper for frontend API calls

class ApiClient {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });

    if (response.status === 401) {
      window.location.href = '/auth/signin';
      throw new Error('Unauthorized');
    }

    if (response.status === 429) {
      const data = await response.json();
      throw new Error(`Rate limit exceeded. Try again after ${data.resetAt}`);
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Request failed');
    }

    return response.json();
  }

  get<T>(url: string) {
    return this.request<T>(url);
  }

  post<T>(url: string, body: unknown) {
    return this.request<T>(url, { method: 'POST', body: JSON.stringify(body) });
  }

  put<T>(url: string, body: unknown) {
    return this.request<T>(url, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete<T>(url: string) {
    return this.request<T>(url, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
