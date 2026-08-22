"use client";

import { useEffect, useRef, useState } from "react";
import { getChat, sendChatMessage } from "@/lib/api-client";
import type { ChatMessage } from "@/lib/types";
import { Card } from "./ui";
import { fmtTime } from "@/lib/format";

/** Public, org-wide live chat — any active member can read or post. Polls every few seconds, same pattern as the live scoreboard. */
export function LiveChannel() {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	const listRef = useRef<HTMLDivElement | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	async function load() {
		const { data } = await getChat();
		setMessages(data.messages ?? []);
	}

	useEffect(() => {
		load();
		pollRef.current = setInterval(load, 3000);
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	useEffect(() => {
		if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
	}, [messages.length]);

	async function send() {
		const trimmed = text.trim();
		if (!trimmed || sending) return;
		setSending(true);
		setError("");
		const { ok, data } = await sendChatMessage(trimmed);
		if (!ok) setError(data.error ?? "Could not send that.");
		else setText("");
		await load();
		setSending(false);
	}

	return (
		<Card title="Live channel">
			<div ref={listRef} className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
				{messages.length === 0 ? (
					<p className="py-4 text-center text-sm text-muted">No messages yet — say hello.</p>
				) : (
					messages.map((m) => (
						<div key={m.id} className="text-sm">
							<span className="font-semibold">{m.name}</span>
							<span className="ml-1.5 text-xs text-muted">{fmtTime(m.createdAt)}</span>
							<p className="break-words">{m.text}</p>
						</div>
					))
				)}
			</div>
			{error ? <p className="mt-2 text-xs text-bad">{error}</p> : null}
			<div className="mt-3 flex gap-2 border-t border-border pt-3">
				<input
					className="input flex-1"
					placeholder="Message everyone in the org…"
					value={text}
					maxLength={500}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") send();
					}}
				/>
				<button className="btn-primary shrink-0" disabled={sending || !text.trim()} onClick={send}>Send</button>
			</div>
		</Card>
	);
}
