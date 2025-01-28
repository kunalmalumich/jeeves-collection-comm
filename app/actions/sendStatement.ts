"use server";

import { env } from "../config/env";

export async function sendStatement(formData: FormData) {
  try {
    console.log("Starting sendStatement function");
    console.log("FormData contents:");
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`);
    }

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : env.NEXT_PUBLIC_APP_URL;
    console.log("Sending statement to:", `${baseUrl}/api/send-statement`);

    const response = await fetch(`${baseUrl}/api/send-statement`, {
      method: "POST",
      body: formData,
    });

    console.log("Response status:", response.status);
    const responseData = await response.json();
    console.log("Response data:", responseData);

    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${responseData.error || "Unknown error"}`,
      );
    }

    return {
      success: true,
      message: "Statement sent successfully",
      conversationSid: responseData.conversationSid,
    };
  } catch (error) {
    console.error("Error in sendStatement:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace available",
    );
    return {
      success: false,
      message: "Failed to send statement",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
