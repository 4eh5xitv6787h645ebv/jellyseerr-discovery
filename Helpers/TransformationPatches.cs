using System.Text.RegularExpressions;
using JellyseerrDiscovery.Models;

namespace JellyseerrDiscovery.Helpers;

public static class TransformationPatches
{
    public static string IndexHtml(PatchRequestPayload content)
    {
        if (string.IsNullOrEmpty(content.Contents))
        {
            return content.Contents ?? string.Empty;
        }

        var contents = content.Contents;

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
