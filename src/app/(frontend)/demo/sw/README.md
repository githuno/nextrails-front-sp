
# Service Worker デモページについて

このデモページは、`useServiceWorker` フックの使用方法を示す2種類のデモを提供しています：

## 1. シンプルデモ (`/demo/sw/simple`)

学習コストの低い基本的な使い方を示すデモです。以下の機能を実装しています：

- Service Workerの登録と状態確認
- 簡単なメッセージ送受信
- イベント購読の基本的な使い方

初めて`useServiceWorker`を使う方は、このデモからスタートすることをお勧めします。

## 2. 詳細デモ (`/demo/sw`)

`useServiceWorker`の全機能を体験できる高度なデモです。以下の機能が含まれています：

- Service Workerの詳細な状態と登録情報
- 登録、登録解除、更新チェックなどの基本操作
- 双方向メッセージングとイベント購読
- キャッシュ操作
- skipWaitingなどの高度な機能

アプリケーションでService Workerを本格的に活用したい場合は、このデモを参考にしてください。

## ファイル構成

- `/hooks/useServiceWorker.tsx` - Service Worker管理用のReactフック
- `/public/sw.js` - デモ用のService Workerスクリプト
- `/demo/sw/simple/page.tsx` - シンプルデモページ
- `/demo/sw/page.tsx` - 詳細デモページ

## 参考

このデモは、`useJobWorker`フックの構造と設計パターンを参考にして作成されています。