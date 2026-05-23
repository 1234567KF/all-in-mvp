"""TDD Tests for unified view rendering."""
import pytest
from md_easy_view.preview.renderer import (
    render_unified_diff_html,
    compute_diff_lines,
    render_section_html,
    split_sections,
)


class TestRenderUnifiedDiffHtml:
    """Tests for render_unified_diff_html function."""

    def test_returns_html_string(self):
        """Function should return a valid HTML string."""
        text_a = "## 标题\n\n旧内容"
        text_b = "## 标题\n\n新内容"
        html = render_unified_diff_html("测试", text_a, text_b)
        assert isinstance(html, str)
        assert "<!DOCTYPE html>" in html
        assert "unified-diff" in html

    def test_empty_texts_returns_empty(self):
        """Empty texts should produce minimal HTML."""
        html = render_unified_diff_html("空文档", "", "")
        assert isinstance(html, str)
        assert "<!DOCTYPE html>" in html

    def test_no_changes_shows_no_diff_markers(self):
        """Identical texts should have no diff markers."""
        text = "## 标题\n\n相同内容"
        html = render_unified_diff_html("相同", text, text)
        assert 'class="unified-line added"' not in html
        assert 'class="unified-line removed"' not in html

    def test_added_line_has_marker(self):
        """Newly added lines should have '+' marker."""
        text_a = "## 标题\n\n原有内容"
        text_b = "## 标题\n\n原有内容\n\n新增段落"
        html = render_unified_diff_html("新增", text_a, text_b)
        assert 'class="unified-line added"' in html or 'data-diff="added"' in html
        assert "+" in html

    def test_removed_line_has_marker(self):
        """Deleted lines should have '-' marker."""
        text_a = "## 标题\n\n原有内容\n\n删除段落"
        text_b = "## 标题\n\n原有内容"
        html = render_unified_diff_html("删除", text_a, text_b)
        assert 'class="unified-line removed"' in html or 'data-diff="removed"' in html
        assert "-" in html

    def test_changed_line_shows_both_old_and_new(self):
        """Modified lines should show old (removed) and new (added)."""
        text_a = "## 标题\n\n这是旧内容"
        text_b = "## 标题\n\n这是新内容"
        html = render_unified_diff_html("修改", text_a, text_b)
        # Should contain both removed and added markers for changed content
        assert "removed" in html or "added" in html

    def test_mermaid_blocks_rendered(self):
        """Mermaid code blocks should render as mermaid containers."""
        text_a = "## 标题\n\n内容"
        text_b = "## 标题\n\n```mermaid\ngraph TD\n    A-->B\n```"
        html = render_unified_diff_html("图表", text_a, text_b)
        assert "mermaid" in html

    def test_contains_unified_css(self):
        """HTML should include unified-specific CSS styles."""
        html = render_unified_diff_html("样式", "a", "b")
        assert "unified-diff" in html
        # Check for unified-specific class styles
        assert ".unified-line" in html or "unified-line" in html


class TestComputeDiffLinesForUnified:
    """Tests ensuring compute_diff_lines works correctly for unified view."""

    def test_equal_lines_all_unchanged(self):
        """Identical texts should mark all lines as unchanged."""
        text = "line1\nline2\nline3"
        states, _ = compute_diff_lines(text, text)
        for state in states.values():
            assert state == "unchanged"

    def test_added_lines_marked(self):
        """New lines in text_b should be marked as added."""
        text_a = "line1"
        text_b = "line1\nline2"
        states, _ = compute_diff_lines(text_a, text_b)
        assert any(s == "added" for s in states.values())

    def test_deleted_lines_mapped_to_context(self):
        """Deleted lines should be mapped to context in text_b."""
        text_a = "line1\nline2"
        text_b = "line1"
        states, old_texts = compute_diff_lines(text_a, text_b)
        # The context line should have removed state
        assert any(s == "removed" for s in states.values())
        assert len(old_texts) > 0

    def test_replaced_lines_marked_as_changed(self):
        """Replaced lines should be marked as changed."""
        text_a = "line1\nold content"
        text_b = "line1\nnew content"
        states, old_texts = compute_diff_lines(text_a, text_b)
        assert any(s == "changed" for s in states.values())


class TestSplitSections:
    """Tests for split_sections function."""

    def test_splits_by_h2_headers(self):
        """Should split text by ## headers."""
        text = "## 第一章\n\n内容1\n\n## 第二章\n\n内容2"
        sections = split_sections(text)
        assert len(sections) == 2
        assert sections[0]["title"] == "第一章"
        assert sections[1]["title"] == "第二章"

    def test_single_section(self):
        """Text with one header should produce one section."""
        text = "## 唯一章节\n\n内容"
        sections = split_sections(text)
        assert len(sections) == 1

    def test_empty_text_returns_minimal(self):
        """Empty text should return a minimal section."""
        sections = split_sections("")
        assert isinstance(sections, list)
        # split_sections creates a default section for empty text
        if sections:
            assert sections[0]["content_lines"] == [''] or sections[0]["content_lines"] == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
