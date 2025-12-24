// Path: app/layout.jsx
import "./globals.css";

export const metadata = {
  title: "eBay Browse Search",
  description: "Search eBay by keyword and sort by newly listed"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
