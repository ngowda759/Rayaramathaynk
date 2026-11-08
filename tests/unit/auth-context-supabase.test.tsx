import React from "react";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
import { authService } from "@/services/auth.service";

let authStateCallback: ((event: string, session: any) => Promise<void>) | null = null;
const mockUnsubscribe = jest.fn();

const mockGetSession = jest.fn().mockResolvedValue({
  data: {
    session: {
      access_token: "test-token-123",
      user: {
        id: "user-uuid-1",
        email: "admin@example.com",
        user_metadata: { name: "Temple Admin" },
        email_confirmed_at: "2026-11-01T00:00:00Z",
      },
    },
  },
});

const mockOnAuthStateChange = jest.fn((callback) => {
  authStateCallback = callback;
  return {
    data: {
      subscription: { unsubscribe: mockUnsubscribe },
    },
  };
});

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: any) => mockOnAuthStateChange(cb),
    },
  }),
}));

jest.mock("@/services/auth.service", () => ({
  authService: {
    getUserProfile: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    forgotPassword: jest.fn(),
  },
}));

function TestConsumer() {
  const { user, profile, loading, canAccessAdmin, sevaRole } = useAuthContext();
  if (loading) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="user-id">{user?.id}</div>
      <div data-testid="user-uid">{user?.uid}</div>
      <div data-testid="user-email">{user?.email}</div>
      <div data-testid="user-name">{user?.displayName}</div>
      <div data-testid="profile-role">{profile?.role}</div>
      <div data-testid="can-admin">{String(canAccessAdmin)}</div>
      <div data-testid="seva-role">{sevaRole ?? "none"}</div>
    </div>
  );
}

describe("AuthContext (Supabase)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.getUserProfile as jest.Mock).mockResolvedValue({
      uid: "user-uuid-1",
      email: "admin@example.com",
      name: "Temple Admin",
      role: "temple_admin",
      isActive: true,
      isApproved: true,
    });
  });

  it("loads session, initializes user, and fetches profile", async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId("user-id").textContent).toBe("user-uuid-1");
    expect(screen.getByTestId("user-uid").textContent).toBe("user-uuid-1");
    expect(screen.getByTestId("user-email").textContent).toBe("admin@example.com");
    expect(screen.getByTestId("user-name").textContent).toBe("Temple Admin");
    expect(screen.getByTestId("profile-role").textContent).toBe("temple_admin");
    expect(screen.getByTestId("can-admin").textContent).toBe("true");
    expect(screen.getByTestId("seva-role").textContent).toBe("temple_admin");
  });

  it("handles sign out via onAuthStateChange callback", async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId("user-id").textContent).toBe("user-uuid-1");

    await act(async () => {
      if (authStateCallback) {
        await authStateCallback("SIGNED_OUT", null);
      }
    });

    expect(screen.getByTestId("user-id").textContent).toBe("");
    expect(screen.getByTestId("can-admin").textContent).toBe("false");
  });
});
