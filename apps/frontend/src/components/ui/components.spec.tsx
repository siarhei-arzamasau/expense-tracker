// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Checkbox } from "./checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Input } from "./input";
import { Label } from "./label";
import { PasswordInput } from "./password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("shared UI primitives", () => {
  it("renders alert and card slots with caller content", () => {
    render(
      <>
        <Alert variant="destructive" className="custom-alert">
          <AlertTitle>Problem</AlertTitle>
          <AlertDescription>Try again</AlertDescription>
        </Alert>
        <Card className="custom-card">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>July</CardDescription>
            <CardAction>Action</CardAction>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      </>,
    );

    expect(screen.getByRole("alert")).toHaveClass("custom-alert");
    expect(screen.getByText("Summary").closest("[data-slot=card]")).toHaveClass("custom-card");
    expect(screen.getByText("Content")).toHaveAttribute("data-slot", "card-content");
    expect(screen.getByText("Footer")).toHaveAttribute("data-slot", "card-footer");
  });

  it("lets Button delegate semantics to its child", () => {
    render(
      <Button asChild variant="link" size="sm">
        <Link href="/terms">Terms</Link>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Terms" });
    expect(link).toHaveAttribute("href", "/terms");
    expect(link).toHaveAttribute("data-variant", "link");
  });

  it("forwards input and label attributes to native controls", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" className="custom-input" />
      </>,
    );

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email")).toHaveClass("custom-input");
  });

  it("toggles a password field without submitting its surrounding form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" defaultValue="secret" />
      </form>,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("type", "button");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the password visibility control with the input", () => {
    render(<PasswordInput aria-label="Password" disabled />);

    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
  });

  it("exposes checkbox state through its accessible role", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Accept terms" />);

    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("switches the active tab and its panel", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="profile" orientation="vertical">
        <TabsList variant="line">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">Profile panel</TabsContent>
        <TabsContent value="security">Security panel</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Security" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Security panel");
  });
});

function ExampleForm({ onSubmit }: { onSubmit: (values: { email: string }) => void }) {
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: "Email is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormDescription>Where receipts are sent</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}

/**
 * The shape every form in this app actually uses: no `FormDescription`. shadcn's
 * `FormControl` names the description id unconditionally, which left each of
 * these fields pointing `aria-describedby` at an element that was never
 * rendered.
 */
function DescriptionlessForm() {
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(vi.fn())}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: "Email is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}

describe("form primitives", () => {
  it("links the label, description, and validation message to the input", async () => {
    const user = userEvent.setup();
    render(<ExampleForm onSubmit={vi.fn()} />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input.getAttribute("aria-describedby")).toContain("form-item-description");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain("form-item-message");
  });

  it("submits the controlled field when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ExampleForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "demo@example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      { email: "demo@example.com" },
      expect.objectContaining({ type: "submit" }),
    );
    expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
  });

  // Every IDREF in aria-describedby has to resolve. A dangling one is not
  // "harmlessly ignored": it is broken ARIA on every field of every form in the
  // product, and in the error case it sits beside the id that does resolve.
  it("names no description when the field has none, rather than a dangling id", async () => {
    const user = userEvent.setup();
    render(<DescriptionlessForm />);

    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-describedby");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Email is required");

    // Only the message now — and the id it names is on screen.
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toMatch(/form-item-message$/);
    expect(describedBy).not.toContain("description");
    for (const id of (describedBy ?? "").split(" ")) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
