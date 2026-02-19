"""Skills 执行器 - 加载和执行 YAML/Python Skills"""
import os
import yaml
import importlib.util
from pathlib import Path
from typing import Any

SKILLS_DIR = Path(os.environ.get("SKILLS_DIR", "/app/skills"))


def get_skills_dir() -> Path:
    """获取 skills 目录，支持本地开发和容器环境"""
    if SKILLS_DIR.exists():
        return SKILLS_DIR
    local = Path(__file__).parent.parent.parent.parent / "skills"
    if local.exists():
        return local
    return SKILLS_DIR


def load_registry() -> list[dict]:
    """从 registry.yaml 加载所有已注册的 skill"""
    skills_dir = get_skills_dir()
    registry_path = skills_dir / "registry.yaml"
    if not registry_path.exists():
        return []
    with open(registry_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("skills", [])


def load_yaml_skill(skill_path: str) -> dict | None:
    """加载 YAML skill 配置"""
    skills_dir = get_skills_dir()
    full_path = skills_dir / skill_path
    if not full_path.exists():
        return None
    with open(full_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_python_skill(skill_path: str) -> Any | None:
    """动态加载 Python skill 模块"""
    skills_dir = get_skills_dir()
    full_path = skills_dir / skill_path
    if not full_path.exists():
        return None
    spec = importlib.util.spec_from_file_location("skill_module", full_path)
    if not spec or not spec.loader:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def execute_yaml_skill(
    skill_config: dict,
    params: dict[str, str],
    context: str = "",
) -> str:
    """执行 YAML skill: 填充 prompt 模板，调用 AI"""
    from app.services.ai_service import stream_chat

    prompt_template = skill_config.get("prompt", "")
    # 填充参数
    prompt = prompt_template
    for key, value in params.items():
        prompt = prompt.replace(f"{{{key}}}", value)
    prompt = prompt.replace("{content}", context)

    # 调用 AI
    full_response = ""
    async for chunk in stream_chat(
        [{"role": "user", "content": prompt}],
        provider="claude",
    ):
        full_response += chunk

    return full_response


async def execute_python_skill(
    module: Any,
    params: dict[str, str],
    context: str = "",
) -> str:
    """执行 Python skill 模块的 execute 函数"""
    if hasattr(module, "execute"):
        result = module.execute(params=params, context=context)
        if hasattr(result, "__aiter__"):
            return "".join([chunk async for chunk in result])
        return str(result)
    return "Error: Python skill missing execute() function"


async def execute_skill(skill_name: str, params: dict[str, str], context: str = "") -> dict:
    """统一入口: 根据 skill 名称查找并执行"""
    registry = load_registry()
    skill_entry = next((s for s in registry if s["name"] == skill_name), None)

    if not skill_entry:
        return {"success": False, "error": f"Skill '{skill_name}' not found in registry"}

    skill_type = skill_entry.get("type", "yaml")
    skill_path = skill_entry.get("path", "")

    try:
        if skill_type == "yaml":
            config = load_yaml_skill(skill_path)
            if not config:
                return {"success": False, "error": f"Failed to load YAML skill: {skill_path}"}
            result = await execute_yaml_skill(config, params, context)
        elif skill_type == "python":
            module = load_python_skill(skill_path)
            if not module:
                return {"success": False, "error": f"Failed to load Python skill: {skill_path}"}
            result = await execute_python_skill(module, params, context)
        else:
            return {"success": False, "error": f"Unknown skill type: {skill_type}"}

        return {"success": True, "result": result, "skill": skill_name}
    except Exception as e:
        return {"success": False, "error": str(e), "skill": skill_name}
