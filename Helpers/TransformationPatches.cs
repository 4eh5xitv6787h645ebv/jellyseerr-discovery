using System.Text.RegularExpressions;

namespace JellyseerrDiscovery.Helpers;

public static class TransformationPatches
{
    public static string IndexHtml(dynamic content)
    {
        string contents = content.Contents?.ToString() ?? string.Empty;
        if (string.IsNullOrEmpty(contents))
        {
            return contents;
        }

        var pluginName = "Jellyseerr Discovery";
        var pluginVersion = Plugin.Instance?.Version.ToString() ?? "1.0.0";

        var scriptUrl = "../JellyseerrDiscovery/script";
        var scriptTag = $"<script plugin=\"{pluginName}\" version=\"{pluginVersion}\" src=\"{scriptUrl}\" defer></script>";

        // Remove any existing script tag for this plugin
        var regex = new Regex($"<script[^>]*plugin=[\"']{Regex.Escape(pluginName)}[\"'][^>]*>\\s*</script>\\n?");
        var updatedContent = regex.Replace(contents, string.Empty);

        // Inject the new script tag before </body>
        if (updatedContent.Contains("</body>"))
        {
            return updatedContent.Replace("</body>", $"{scriptTag}\n</body>");
        }

        return updatedContent;
    }
}
