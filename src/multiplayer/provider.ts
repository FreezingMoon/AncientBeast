import { DevvitLobbyProvider } from '../../platforms/devvit/DevvitLobbyProvider';
import { PeerLobbyProvider } from './PeerLobbyProvider';
import type { INetworkBackend } from './types';

export function getNetworkMode(): 'peer' | 'devvit' {
	if (typeof window === 'undefined') {
		return 'peer';
	}

	const url = new URLSearchParams(window.location.search);
	if (url.get('net') === 'devvit') {
		return 'devvit';
	}

	return 'peer';
}

export function createLobbyProvider(): INetworkBackend {
	return getNetworkMode() === 'devvit' ? new DevvitLobbyProvider() : new PeerLobbyProvider();
}
