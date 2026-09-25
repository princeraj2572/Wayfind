import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { makeDoc } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { UploadDropzone } from "./upload-dropzone";

setupMockServer();

const zone = () => screen.getByText(/Drop PDF, DOCX/).closest("div") as HTMLElement;
const file = (name: string) => new File(["x"], name);

function drop(files: File[]) {
  fireEvent.drop(zone(), { dataTransfer: { files } });
}

// The test runtime does not carry file names through multipart, so uploads are identified by their order.
function mockUpload(failAt = 0) {
  const state = { count: 0 };
  server.use(
    http.post("*/api/spaces/1/documents/upload", () => {
      state.count += 1;
      if (state.count === failAt) return HttpResponse.json({ detail: "PDF has no extractable text" }, { status: 400 });
      return HttpResponse.json(makeDoc({ title: `doc ${state.count}` }), { status: 201 });
    }),
  );
  return state;
}

test("dropped files with unsupported extensions are skipped with a message and never uploaded", async () => {
  const uploads = mockUpload();
  renderWithClient(<UploadDropzone spaceId={1} />);
  drop([file("notes.md"), file("photo.PNG"), file("archive.zip")]);
  expect(await screen.findByText(/photo\.PNG: unsupported file type/)).toBeInTheDocument();
  expect(screen.getByText(/archive\.zip: unsupported file type/)).toBeInTheDocument();
  await waitFor(() => expect(uploads.count).toBe(1));
});

test("extensions are matched case-insensitively", async () => {
  const uploads = mockUpload();
  renderWithClient(<UploadDropzone spaceId={1} />);
  drop([file("REPORT.PDF"), file("Notes.MD")]);
  await waitFor(() => expect(uploads.count).toBe(2));
});

test("with several files, one failure does not stop the others and each result is reported", async () => {
  const uploads = mockUpload(2);
  renderWithClient(<UploadDropzone spaceId={1} />);
  drop([file("a.md"), file("broken.pdf"), file("c.txt")]);
  expect(await screen.findByText(/broken\.pdf: PDF has no extractable text/)).toBeInTheDocument();
  await waitFor(() => expect(uploads.count).toBe(3));
  await waitFor(() => expect(screen.getAllByText(/Uploaded/)).toHaveLength(2));
});

function dragLeave(target: HTMLElement, relatedTarget: Element) {
  // jsdom has no DragEvent, so relatedTarget is attached by hand.
  const event = createEvent.dragLeave(target);
  Object.defineProperty(event, "relatedTarget", { value: relatedTarget });
  fireEvent(target, event);
}

test("moving the drag over a child element does not drop the highlight", () => {
  renderWithClient(<UploadDropzone spaceId={1} />);
  const outer = zone();
  fireEvent.dragOver(outer);
  expect(outer.className).toContain("bg-brand-tint");
  dragLeave(outer, outer.querySelector("p") as HTMLElement);
  expect(outer.className).toContain("bg-brand-tint");
  dragLeave(outer, document.body);
  expect(outer.className).not.toContain("bg-brand-tint");
});
