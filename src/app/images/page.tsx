"use client";

import { useCallback, useEffect, useState } from "react";
import { ListGroup, ListGroupItem, Session } from "@/components";
import Image from "next/image";
import { session } from "@/components";

type Item = {
  created_by: string;
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  main_image: string;
  cdt3d_status: string;
  cdt3d_msg: string;
};

export default function Page() {
  // サーバーサイドとクライアントサイドで同じメッセージを表示する ↓
  const [isClient, setIsClient] = useState(false);
  const loadingMessage = "Loading...";
  useEffect(() => {
    setIsClient(true);
  }, []);
  // サーバーサイドとクライアントサイドで同じメッセージを表示する ↑

  const [items, setItems] = useState<Item[]>([]);

  const fetchItems = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/get_objects`,
        {
          method: "POST",
          mode: "cors",
          // credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            user_id: session.userId,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }
      const data = await response.json();
      setItems(data.objects);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  }, [session.userId]);

  useEffect(() => {
    if (isClient) {
      fetchItems();
    }
  }, [isClient, fetchItems]);

  if (!isClient) {
    return <div>{loadingMessage}</div>;
  }

  return (
    <main className="flex flex-col items-center justify-between p-1">
      <h1>Items</h1>
      <ListGroup>
        {items.map((item) => (
          <ListGroupItem key={item.id}>
            <div className="flex items-center gap-4">
              {item.main_image.endsWith(".mp4") ? (
                <video width={150} height={150} controls>
                  <source src={item.main_image} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <Image
                  src={item.main_image}
                  alt={item.name}
                  width={150}
                  height={150}
                />
              )}
              <div>
                <h2 className="text-lg font-bold">{item.name}</h2>
                <p>{item.description}</p>
                <p className="text-sm text-gray-500">
                  Created by: {item.created_by}
                </p>
                <p className="text-sm text-gray-500">
                  Status: {item.cdt3d_status}
                </p>
                <p className="text-sm text-gray-500">
                  Message: {item.cdt3d_msg}
                </p>
                <p className="text-sm text-gray-500">
                  url: <a href={
                    `${process.env.NEXT_PUBLIC_R2_BASE}/${item.id}`
                  }>{item.id}</a>
                </p>
              </div>
            </div>
          </ListGroupItem>
        ))}
      </ListGroup>
    </main>
  );
}