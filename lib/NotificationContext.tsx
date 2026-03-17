"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

interface NotificationContextType {
	permission: NotificationPermission;
	requestPermission: () => Promise<NotificationPermission>;
	sendNotification: (title: string, options?: NotificationOptions) => void;
	isSupported: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
	undefined,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [permission, setPermission] =
		useState<NotificationPermission>("default");
	const [isSupported, setIsSupported] = useState(false);

	useEffect(() => {
		// Check if notifications are supported
		if (typeof window !== "undefined" && "Notification" in window) {
			setIsSupported(true);
			setPermission(Notification.permission);

			// Auto-request permission on first load if not already decided
			if (Notification.permission === "default") {
				// Wait a bit before asking to avoid being intrusive on first load
				setTimeout(() => {
					Notification.requestPermission().then((perm) => {
						setPermission(perm);
					});
				}, 3000);
			}
		} else {
			setIsSupported(false);
		}
	}, []);

	const requestPermission =
		useCallback(async (): Promise<NotificationPermission> => {
			if (!isSupported) {
				return "denied";
			}

			try {
				const perm = await Notification.requestPermission();
				setPermission(perm);
				return perm;
			} catch (_error) {
				return "denied";
			}
		}, [isSupported]);

	const sendNotification = useCallback(
		(title: string, options?: NotificationOptions) => {
			if (!isSupported) {
				return;
			}

			if (permission !== "granted") {
				return;
			}

			try {
				const notification = new Notification(title, {
					icon: "/favicon-32.png",
					badge: "/favicon-16.png",
					...options,
				});

				// Auto-close after 5 seconds
				setTimeout(() => {
					notification.close();
				}, 5000);
			} catch (_error) {}
		},
		[permission, isSupported],
	);

	return (
		<NotificationContext.Provider
			value={{
				permission,
				requestPermission,
				sendNotification,
				isSupported,
			}}
		>
			{children}
		</NotificationContext.Provider>
	);
}

export function useNotifications() {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error(
			"useNotifications must be used within NotificationProvider",
		);
	}
	return context;
}
