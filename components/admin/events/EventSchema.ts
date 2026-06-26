import { z } from "zod";

export const eventSchema = z.object({
  title: z.string().min(3, "Title must contain at least 3 characters."),

  description: z
    .string()
    .min(10, "Description must contain at least 10 characters."),

  location: z.string().min(2, "Location is required."),

  startDate: z.date(),

  endDate: z.date(),

  featured: z.boolean(),

  status: z.enum([
    "Upcoming",
    "Ongoing",
    "Completed",
  ]),
});

export type EventFormValues = z.infer<typeof eventSchema>;
